import { scrubSecrets } from './secret-leak.interceptor';

describe('SecretLeakInterceptor scrubSecrets', () => {
  it('strips credential fields anywhere in the payload and reports paths', () => {
    const payload = {
      user: {
        id: 'u1',
        email: 'a@b.com',
        passwordHash: '$2a$10$leak',
        mfaSecret: 'JBSWY3DP',
      },
      sessions: [{ refreshTokenHash: 'hash', device: 'mac' }],
    };
    const removed = scrubSecrets(payload);

    expect(payload.user.passwordHash).toBeUndefined();
    expect(payload.user.mfaSecret).toBeUndefined();
    expect(payload.sessions[0].refreshTokenHash).toBeUndefined();
    // Legitimate fields are untouched.
    expect(payload.user.email).toBe('a@b.com');
    expect(payload.sessions[0].device).toBe('mac');
    expect(removed).toEqual(
      expect.arrayContaining([
        'user.passwordHash',
        'user.mfaSecret',
        'sessions[0].refreshTokenHash',
      ]),
    );
  });

  it('returns an empty list for clean payloads', () => {
    expect(scrubSecrets({ ok: true, data: [1, 2, 3] })).toEqual([]);
    expect(scrubSecrets('plain string')).toEqual([]);
    expect(scrubSecrets(null)).toEqual([]);
  });

  it('does not strip look-alike but legitimate fields (e.g. webhook secret)', () => {
    const payload = { webhook: { secret: 'whsec_shown_once', url: 'x' } };
    expect(scrubSecrets(payload)).toEqual([]);
    expect(payload.webhook.secret).toBe('whsec_shown_once');
  });

  it('survives circular structures', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => scrubSecrets(a)).not.toThrow();
  });

  it('skips class instances (schema-serialized) but scrubs nested plain objects', () => {
    class Fancy {
      passwordHash = 'schema-will-hide-me';
    }
    const payload = { fancy: new Fancy(), plain: { passwordHash: 'leak' } };
    scrubSecrets(payload);
    expect(payload.fancy.passwordHash).toBe('schema-will-hide-me');
    expect(payload.plain.passwordHash).toBeUndefined();
  });
});
