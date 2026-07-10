import { maskEmail, redact, redactString } from './redact';

describe('security/redact', () => {
  describe('redact (objects)', () => {
    it('redacts values of sensitive keys but keeps the shape', () => {
      const input = {
        email: 'user@example.com',
        password: 'hunter2',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        refreshTokenHash: 'secret-hash',
        authorization: 'Bearer abc.def.ghi',
        apiKey: 'sk-live-1234567890',
        nested: { clientSecret: 'zzz', keep: 'visible' },
      };
      const out = redact(input) as Record<string, any>;

      expect(out.password).toBe('[REDACTED]');
      expect(out.passwordHash).toBe('[REDACTED]');
      expect(out.refreshTokenHash).toBe('[REDACTED]');
      expect(out.authorization).toBe('[REDACTED]');
      expect(out.apiKey).toBe('[REDACTED]');
      expect(out.nested.clientSecret).toBe('[REDACTED]');
      expect(out.nested.keep).toBe('visible');
      // Email is partially masked, not removed (still useful for correlation).
      expect(out.email).toBe('u***@example.com');
    });

    it('does not mutate the original object', () => {
      const input = { password: 'hunter2' };
      redact(input);
      expect(input.password).toBe('hunter2');
    });

    it('handles circular references without throwing', () => {
      const a: any = { name: 'a' };
      a.self = a;
      const out = redact(a) as Record<string, any>;
      expect(out.name).toBe('a');
      expect(out.self).toBe('[Circular]');
    });

    it('caps depth and truncates very long strings', () => {
      const deep = { a: { b: { c: { d: { e: { f: { g: 'too deep' } } } } } } };
      expect(JSON.stringify(redact(deep))).toContain('[Truncated]');

      const long = { note: 'x'.repeat(5000) };
      const out = redact(long, { maxStringLength: 100 }) as Record<string, any>;
      expect(out.note).toContain('[truncated]');
      expect(out.note.length).toBeLessThan(200);
    });

    it('summarises Error objects without a raw stack', () => {
      const out = redact({ err: new Error('boom user@example.com') }) as any;
      expect(out.err.name).toBe('Error');
      expect(out.err.message).toContain('***');
      expect(out.err.stack).toBeUndefined();
    });
  });

  describe('redactString', () => {
    it('scrubs bearer tokens and JWTs from free text', () => {
      const line =
        'auth failed with Authorization: Bearer abcdef1234567890 token';
      expect(redactString(line)).not.toContain('abcdef1234567890');
    });

    it('scrubs a JWT-shaped blob', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT4';
      expect(redactString(`token=${jwt}`)).toBe('token=[REDACTED]');
    });

    it('masks emails', () => {
      expect(maskEmail('alice@corp.com')).toBe('a***@corp.com');
    });
  });
});
