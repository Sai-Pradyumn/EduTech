import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AppConfig } from '../../config/configuration';
import {
  generateTotpSecret,
  otpauthUrl,
  verifyTotp,
} from '../../common/security/totp';
import {
  decryptField,
  encryptField,
  isEncryptedField,
  KeyRing,
  parseKeyRing,
} from '../../common/security/field-encryption';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

/**
 * TOTP multi-factor auth (SECURITY_IMPLEMENTATION.md §6/§17, control AU-03). Provides
 * enrollment, a short-lived login challenge, verification (authenticator code OR a
 * single-use recovery code), and disable. The cryptography lives in common/security/totp.ts
 * (RFC 6238); this service owns the account state machine and persistence.
 *
 * Login flow when MFA is enabled:
 *   1. password verifies → AuthService returns a 5-minute `mfaToken` instead of a session.
 *   2. client POSTs the mfaToken + the 6-digit code to /auth/mfa/verify-login.
 *   3. this service validates the token + code and hands back the userId so AuthService can
 *      issue the real session. The mfaToken alone can never mint a session.
 */

const ISSUER = 'Asta';
const RECOVERY_CODE_COUNT = 10;
const SALT_ROUNDS = 10;
const CHALLENGE_TTL = '5m';
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/1/O/I ambiguity

interface MfaTokenPayload {
  sub: string;
  purpose: 'mfa';
}

@Injectable()
export class MfaService {
  /** Field-encryption ring (DP-03): when FIELD_ENCRYPTION_KEYS is set, TOTP secrets are
   *  stored as AES-256-GCM envelopes, so a DB dump alone can't mint valid codes. Plaintext
   *  legacy secrets remain readable (isEncryptedField dispatch) for zero-downtime rollout. */
  private ring: KeyRing | null | undefined;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private keyRing(): KeyRing | null {
    if (this.ring !== undefined) return this.ring;
    const spec = this.config.get('security.fieldEncryptionKeys', {
      infer: true,
    });
    this.ring = spec ? parseKeyRing(spec) : null;
    return this.ring;
  }

  private protectSecret(secret: string): string {
    const ring = this.keyRing();
    return ring ? encryptField(secret, ring) : secret;
  }

  private revealSecret(stored: string): string {
    const ring = this.keyRing();
    if (ring && isEncryptedField(stored)) return decryptField(stored, ring);
    return stored;
  }

  async status(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.users.findByIdOrThrow(userId);
    return { enabled: Boolean(user.mfaEnabled) };
  }

  /** Step 1 of enrollment: generate + stage a secret and return the QR provisioning URI. */
  async beginEnrollment(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.users.findByIdOrThrow(userId);
    if (user.mfaEnabled)
      throw new BadRequestException(
        'MFA is already enabled. Disable it first to re-enroll.',
      );
    const secret = generateTotpSecret();
    await this.users.setMfaSecret(userId, this.protectSecret(secret));
    return {
      secret,
      otpauthUrl: otpauthUrl({ secret, label: user.email, issuer: ISSUER }),
    };
  }

  /** Step 2 of enrollment: verify the first code, enable MFA, return one-time recovery codes. */
  async activate(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.users.findByIdWithMfa(userId);
    if (!user?.mfaSecret)
      throw new BadRequestException('Start MFA setup first.');
    if (user.mfaEnabled)
      throw new BadRequestException('MFA is already enabled.');
    if (!verifyTotp(this.revealSecret(user.mfaSecret), code))
      throw new UnauthorizedException('Invalid authenticator code.');

    const recoveryCodes = this.generateRecoveryCodes();
    const hashes = await Promise.all(
      recoveryCodes.map((c) =>
        bcrypt.hash(this.normalizeRecovery(c), SALT_ROUNDS),
      ),
    );
    await this.users.enableMfa(userId, hashes);
    // Returned exactly once — the client must show these for the user to save.
    return { recoveryCodes };
  }

  /** Disable MFA. Requires a valid authenticator or recovery code (proves possession). */
  async disable(userId: string, code: string): Promise<{ disabled: true }> {
    const user = await this.users.findByIdWithMfa(userId);
    if (!user?.mfaEnabled) throw new BadRequestException('MFA is not enabled.');
    if (!(await this.verifyUserCode(user, code)))
      throw new UnauthorizedException('Invalid code.');
    await this.users.disableMfa(userId);
    return { disabled: true };
  }

  /** Mint the short-lived token that gates the second login factor. */
  async createLoginChallenge(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, purpose: 'mfa' },
      {
        secret: this.config.get('jwt.secret', { infer: true }),
        expiresIn: CHALLENGE_TTL,
      },
    );
  }

  /** Validate the challenge token + user's code; returns the userId on success. */
  async verifyLoginChallenge(mfaToken: string, code: string): Promise<string> {
    let payload: MfaTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaTokenPayload>(mfaToken, {
        secret: this.config.get('jwt.secret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException(
        'MFA session expired. Please log in again.',
      );
    }
    if (payload.purpose !== 'mfa')
      throw new UnauthorizedException('Invalid MFA token.');

    const user = await this.users.findByIdWithMfa(payload.sub);
    if (!user?.mfaEnabled)
      throw new UnauthorizedException('MFA is not enabled for this account.');
    if (!(await this.verifyUserCode(user, code)))
      throw new UnauthorizedException('Invalid code.');
    return payload.sub;
  }

  /**
   * Accept either the current TOTP code or a single-use recovery code. Recovery codes are
   * consumed (removed) on use so each works exactly once.
   */
  private async verifyUserCode(
    user: UserDocument,
    code: string,
  ): Promise<boolean> {
    const raw = (code ?? '').trim();
    if (user.mfaSecret && verifyTotp(this.revealSecret(user.mfaSecret), raw))
      return true;

    const hashes = user.mfaRecoveryHashes ?? [];
    if (hashes.length === 0) return false;
    const candidate = this.normalizeRecovery(raw);
    if (!candidate) return false;

    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(candidate, hashes[i])) {
        const remaining = hashes.filter((_, idx) => idx !== i);
        await this.users.setRecoveryHashes(user.id as string, remaining);
        return true;
      }
    }
    return false;
  }

  private normalizeRecovery(code: string): string {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const bytes = randomBytes(8);
      let s = '';
      for (let j = 0; j < 8; j++)
        s += RECOVERY_ALPHABET[bytes[j] % RECOVERY_ALPHABET.length];
      codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
    }
    return codes;
  }
}
