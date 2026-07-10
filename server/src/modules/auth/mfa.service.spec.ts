import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { totp } from '../../common/security/totp';
import { AppConfig } from '../../config/configuration';
import { UsersService } from '../users/users.service';
import { MfaService } from './mfa.service';

/** In-memory UsersService stand-in exposing just the methods MfaService touches. */
class FakeUsers {
  store = new Map<string, any>();
  seed(user: any) {
    this.store.set(user.id, { mfaEnabled: false, ...user });
  }
  findByIdOrThrow(id: string) {
    const u = this.store.get(id);
    if (!u) throw new Error('User not found');
    return Promise.resolve(u);
  }
  findByIdWithMfa(id: string) {
    return Promise.resolve(this.store.get(id) ?? null);
  }
  async setMfaSecret(id: string, secret: string) {
    const u = this.store.get(id);
    u.mfaSecret = secret;
    u.mfaEnabled = false;
  }
  async enableMfa(id: string, hashes: string[]) {
    const u = this.store.get(id);
    u.mfaEnabled = true;
    u.mfaRecoveryHashes = hashes;
    u.mfaEnrolledAt = new Date();
  }
  async disableMfa(id: string) {
    const u = this.store.get(id);
    u.mfaEnabled = false;
    delete u.mfaSecret;
    delete u.mfaRecoveryHashes;
  }
  async setRecoveryHashes(id: string, hashes: string[]) {
    this.store.get(id).mfaRecoveryHashes = hashes;
  }
}

function makeService() {
  const users = new FakeUsers();
  users.seed({ id: 'u1', email: 'admin@asta.dev' });
  const jwt = new JwtService({});
  const config = {
    get: () => 'test-jwt-secret',
  } as unknown as ConfigService<AppConfig, true>;
  const mfa = new MfaService(users as unknown as UsersService, jwt, config);
  return { mfa, users };
}

/** Enroll + activate 'u1' and return its secret + recovery codes. */
async function enroll(mfa: MfaService) {
  const { secret } = await mfa.beginEnrollment('u1');
  const code = totp(secret);
  const { recoveryCodes } = await mfa.activate('u1', code);
  return { secret, recoveryCodes };
}

describe('MfaService', () => {
  it('reports disabled before enrollment', async () => {
    const { mfa } = makeService();
    expect(await mfa.status('u1')).toEqual({ enabled: false });
  });

  it('enrolls and activates with a valid TOTP code, returning recovery codes', async () => {
    const { mfa } = makeService();
    const setup = await mfa.beginEnrollment('u1');
    expect(setup.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.otpauthUrl).toContain('otpauth://totp/');

    const { recoveryCodes } = await mfa.activate('u1', totp(setup.secret));
    expect(recoveryCodes).toHaveLength(10);
    expect(await mfa.status('u1')).toEqual({ enabled: true });
  });

  it('rejects activation with a wrong code', async () => {
    const { mfa } = makeService();
    await mfa.beginEnrollment('u1');
    await expect(mfa.activate('u1', '000000')).rejects.toThrow();
    expect(await mfa.status('u1')).toEqual({ enabled: false });
  });

  it('refuses re-enrollment while already enabled', async () => {
    const { mfa } = makeService();
    await enroll(mfa);
    await expect(mfa.beginEnrollment('u1')).rejects.toThrow(/already enabled/i);
  });

  describe('login challenge', () => {
    it('accepts the current authenticator code', async () => {
      const { mfa } = makeService();
      const { secret } = await enroll(mfa);
      const token = await mfa.createLoginChallenge('u1');
      const userId = await mfa.verifyLoginChallenge(token, totp(secret));
      expect(userId).toBe('u1');
    });

    it('rejects a wrong code', async () => {
      const { mfa } = makeService();
      await enroll(mfa);
      const token = await mfa.createLoginChallenge('u1');
      await expect(mfa.verifyLoginChallenge(token, '000000')).rejects.toThrow();
    });

    it('rejects a token signed with the wrong purpose/secret', async () => {
      const { mfa } = makeService();
      const { secret } = await enroll(mfa);
      const jwt = new JwtService({});
      const forged = await jwt.signAsync(
        { sub: 'u1', purpose: 'access' },
        { secret: 'test-jwt-secret' },
      );
      await expect(
        mfa.verifyLoginChallenge(forged, totp(secret)),
      ).rejects.toThrow(/invalid mfa token/i);
    });

    it('accepts a recovery code once, then never again', async () => {
      const { mfa } = makeService();
      const { recoveryCodes } = await enroll(mfa);
      const code = recoveryCodes[0];

      const t1 = await mfa.createLoginChallenge('u1');
      expect(await mfa.verifyLoginChallenge(t1, code)).toBe('u1');

      const t2 = await mfa.createLoginChallenge('u1');
      await expect(mfa.verifyLoginChallenge(t2, code)).rejects.toThrow();
    });
  });

  describe('disable', () => {
    it('disables with a valid code and clears the secret', async () => {
      const { mfa, users } = makeService();
      const { secret } = await enroll(mfa);
      await mfa.disable('u1', totp(secret));
      expect(await mfa.status('u1')).toEqual({ enabled: false });
      expect(users.store.get('u1').mfaSecret).toBeUndefined();
    });

    it('refuses to disable with a wrong code', async () => {
      const { mfa } = makeService();
      await enroll(mfa);
      await expect(mfa.disable('u1', '000000')).rejects.toThrow();
      expect(await mfa.status('u1')).toEqual({ enabled: true });
    });
  });
});
