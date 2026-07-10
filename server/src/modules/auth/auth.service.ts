import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppConfig } from '../../config/configuration';
import { JwtPayload } from '../../common/interfaces';
import { OrgRole, Role } from '../../common/enums';
import {
  lockState,
  registerFailure,
} from '../../common/security/login-throttle';
import { checkBreachedPassword } from '../../common/security/breached-password';
import { JWT_AUDIENCE, JWT_ISSUER } from '../../common/security/jwt-claims';
import {
  getAllowedEmailDomains,
  isAllowedEmailDomain,
} from '../../common/util/email-domains';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { OtpService } from './otp.service';
import { MfaService } from './mfa.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isOnboarded: boolean;
  platformRole?: OrgRole;
  primaryOrganization?: string;
  isPlatformAdmin: boolean;
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
}

export interface PendingVerification {
  pendingVerification: true;
  email: string;
}

/** Returned when the password is correct but a second factor (TOTP) is still required. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly otp: OtpService,
    private readonly mfa: MfaService,
  ) {}

  /** The configured email-domain allowlist (env EMAIL_ALLOWED_DOMAINS, or defaults). */
  allowedDomains(): string[] {
    return getAllowedEmailDomains(process.env.EMAIL_ALLOWED_DOMAINS);
  }

  private assertAllowedDomain(email: string): void {
    if (!isAllowedEmailDomain(email, this.allowedDomains())) {
      throw new ForbiddenException(
        `Sign-ups are limited to: ${this.allowedDomains().join(', ')}`,
      );
    }
  }

  /** Step 1 of signup: validate the domain, create an UNVERIFIED account, and email an OTP.
   *  Returns no tokens — the client must verify the code via verifyOtp(). */
  async register(dto: RegisterDto): Promise<PendingVerification> {
    this.assertAllowedDomain(dto.email);

    // AU-05: refuse passwords already circulating in public breach corpora. k-anonymity —
    // only 5 hex chars of the SHA-1 leave the server; fails open when the API is down.
    if (this.config.get('security.passwordBreachCheck', { infer: true })) {
      const breach = await checkBreachedPassword(dto.password);
      if (breach.breached) {
        throw new BadRequestException(
          'This password has appeared in a public data breach. Please choose a different one.',
        );
      }
    }

    const existing = await this.users.findByEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    if (existing) {
      if (existing.emailVerified) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      // Unverified re-registration — refresh the password and re-send the code.
      await this.users.setPasswordHash(existing.id, passwordHash);
    } else {
      await this.users.create({
        name: dto.name,
        email: dto.email,
        passwordHash,
        emailVerified: false,
      });
    }

    await this.otp.issue(dto.email);
    return { pendingVerification: true, email: dto.email.toLowerCase() };
  }

  /** Step 2 of signup: verify the OTP, mark the account verified, and issue a session. */
  async verifyOtp(email: string, code: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('No account for this email.');
    await this.otp.verify(email, code);
    await this.users.setEmailVerified(user.id);
    await this.users.touchLastActive(user.id);
    return this.issueSession(user);
  }

  /** Re-send a signup OTP (cooldown enforced in OtpService). */
  async resendOtp(email: string): Promise<{ sent: true }> {
    const user = await this.users.findByEmail(email);
    if (user && user.emailVerified) {
      throw new ConflictException(
        'This email is already verified — just log in.',
      );
    }
    await this.otp.issue(email);
    return { sent: true };
  }

  /** Precomputed hash so unknown-email logins still pay one bcrypt compare — without it,
   *  the fast "no user" path leaks account existence through response timing (§6). */
  private readonly timingDummyHash = bcrypt.hashSync(
    'asta.timing.equalization.dummy',
    SALT_ROUNDS,
  );

  async login(
    dto: LoginDto,
  ): Promise<AuthResult | PendingVerification | MfaChallenge> {
    const user = await this.users.findByEmailWithSecret(dto.email);
    if (!user) {
      await bcrypt.compare(dto.password, this.timingDummyHash);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash)
      throw new UnauthorizedException(
        'This account uses Google sign-in. Continue with Google.',
      );

    // Per-account brute-force throttle (AU-04). Refuse credential logins while the account
    // is locked, before touching bcrypt — keeps the neutral message and avoids the work.
    const now = Date.now();
    if (lockState(user.loginLockedUntil?.getTime() ?? null, now).locked) {
      throw new UnauthorizedException(
        'Too many failed attempts. Please try again later.',
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const next = registerFailure(user.failedLoginAttempts ?? 0, now);
      await this.users.applyLoginThrottle(
        user.id,
        next.attempts,
        next.lockedUntilMs,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // TEMP (see TODO-REVOKE-OTP-SKIP.md): OTP-after-password step disabled.
    // Unverified email signup → re-send a code and tell the client to show the OTP step.
    // if (user.emailVerified === false) {
    //   await this.otp.issue(user.email).catch(() => undefined);
    //   return { pendingVerification: true, email: user.email };
    // }

    // Successful auth clears any accumulated throttle so a genuine user starts fresh.
    if ((user.failedLoginAttempts ?? 0) > 0 || user.loginLockedUntil) {
      await this.users.resetLoginThrottle(user.id);
    }

    // MFA gate (AU-03): password alone is not a session for MFA-enabled accounts — hand
    // back a short-lived challenge the client redeems at /auth/mfa/verify-login.
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        mfaToken: await this.mfa.createLoginChallenge(user.id as string),
      };
    }

    await this.users.touchLastActive(user.id);
    return this.issueSession(user);
  }

  /** Complete an MFA-gated login: verify the challenge token + code, then issue the session. */
  async verifyMfaLogin(mfaToken: string, code: string): Promise<AuthResult> {
    const userId = await this.mfa.verifyLoginChallenge(mfaToken, code);
    const user = await this.users.findByIdOrThrow(userId);
    await this.users.touchLastActive(userId);
    return this.issueSession(user);
  }

  /** Sign in (or auto-provision) via a verified Google profile (Phase 10 · OAuth). */
  async googleLogin(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<AuthResult | MfaChallenge> {
    this.assertAllowedDomain(profile.email);
    const user = await this.users.findOrCreateGoogle(profile);
    // MFA applies to federated sign-in too — a compromised Google session still can't
    // bypass the second factor on an MFA-enabled account.
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        mfaToken: await this.mfa.createLoginChallenge(user.id as string),
      };
    }
    await this.users.touchLastActive(user.id);
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const strict = this.config.get('security.jwtStrictClaims', {
      infer: true,
    });
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
        ...(strict ? { issuer: JWT_ISSUER, audience: JWT_AUDIENCE } : {}),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findByIdWithRefresh(payload.sub);
    if (!user || !user.refreshTokenHash)
      throw new UnauthorizedException('Session expired');

    // Session-generation check: a bumped tokenVersion (logout-all / forced revocation)
    // invalidates every token signed before the bump, even if its hash still matches.
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0))
      throw new UnauthorizedException('Session revoked');

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Session expired');

    return this.rotateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.users.setRefreshTokenHash(userId, null);
  }

  /** Log out everywhere: revoke all refresh tokens by bumping the session generation.
   *  Access tokens (≤15m) expire on their own shortly after. */
  async logoutAll(userId: string): Promise<void> {
    await this.users.bumpTokenVersion(userId);
  }

  async getPublicUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findByIdOrThrow(userId);
    return this.toPublicUser(user);
  }

  private async issueSession(user: UserDocument): Promise<AuthResult> {
    const tokens = await this.rotateTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  private async rotateTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id as string,
      email: user.email,
      role: user.role,
      // Session generation: bumping user.tokenVersion invalidates every refresh token.
      tv: user.tokenVersion ?? 0,
    };

    // Always SIGN with issuer/audience; strict VERIFICATION is behind JWT_STRICT_CLAIMS
    // so pre-existing tokens age out over one refresh lifetime before enforcement.
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.secret', { infer: true }),
      expiresIn: this.config.get('jwt.expiresIn', { infer: true }),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.config.get('jwt.refreshExpiresIn', { infer: true }),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    await this.users.setRefreshTokenHash(
      user.id as string,
      await bcrypt.hash(refreshToken, SALT_ROUNDS),
    );
    return { accessToken, refreshToken };
  }

  private toPublicUser(user: UserDocument): PublicUser {
    const isPlatformAdmin =
      user.role === Role.Admin ||
      user.platformRole === OrgRole.PlatformAdmin ||
      user.platformRole === OrgRole.SuperAdmin;
    return {
      id: user.id as string,
      name: user.name,
      email: user.email,
      role: user.role,
      isOnboarded: user.isOnboarded,
      platformRole: user.platformRole,
      primaryOrganization: user.primaryOrganization
        ? String(user.primaryOrganization)
        : undefined,
      isPlatformAdmin,
    };
  }
}
