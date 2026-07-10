import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUrl,
  totp,
  verifyTotp,
} from './totp';

/**
 * Correctness is pinned to authoritative standards vectors, not our own expectations:
 *  - HOTP counter values from RFC 4226 Appendix D.
 *  - TOTP time values from RFC 6238 Appendix B (SHA1, 8 digits, secret "12345678901234567890").
 * If truncation/encoding ever regresses, these fail immediately.
 */
describe('security/totp', () => {
  const RFC_ASCII_SECRET = Buffer.from('12345678901234567890');

  describe('RFC 4226 HOTP vectors (Appendix D)', () => {
    const expected = [
      '755224',
      '287082',
      '359152',
      '969429',
      '338314',
      '254676',
      '287922',
      '162583',
      '399871',
      '520489',
    ];
    it('matches the published 6-digit HOTP sequence', () => {
      expected.forEach((code, counter) => {
        expect(hotp(RFC_ASCII_SECRET, counter, 6)).toBe(code);
      });
    });
  });

  describe('RFC 6238 TOTP vectors (Appendix B, SHA1, 8 digits)', () => {
    const vectors: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ];
    it.each(vectors)('t=%is → %s', (timeSec, code) => {
      // Drive the core through totp() using the RFC's raw secret, base32-wrapped.
      const secret = base32Encode(RFC_ASCII_SECRET);
      expect(
        totp(secret, { timeMs: timeSec * 1000, digits: 8, step: 30 }),
      ).toBe(code);
    });
  });

  describe('base32 round-trip', () => {
    it('encodes and decodes back to the original bytes', () => {
      const original = Buffer.from('12345678901234567890');
      expect(base32Decode(base32Encode(original)).equals(original)).toBe(true);
    });
    it('rejects invalid characters', () => {
      expect(() => base32Decode('018!')).toThrow();
    });
  });

  describe('verifyTotp', () => {
    it('accepts the current code', () => {
      const secret = generateTotpSecret();
      const now = 1_700_000_000_000;
      const code = totp(secret, { timeMs: now });
      expect(verifyTotp(secret, code, { timeMs: now })).toBe(true);
    });

    it('accepts a code from the previous step within the drift window', () => {
      const secret = generateTotpSecret();
      const now = 1_700_000_000_000;
      const prev = totp(secret, { timeMs: now - 30_000 });
      expect(verifyTotp(secret, prev, { timeMs: now, window: 1 })).toBe(true);
    });

    it('rejects a code outside the drift window', () => {
      const secret = generateTotpSecret();
      const now = 1_700_000_000_000;
      const stale = totp(secret, { timeMs: now - 5 * 60_000 });
      expect(verifyTotp(secret, stale, { timeMs: now, window: 1 })).toBe(false);
    });

    it('rejects malformed / wrong-length input without throwing', () => {
      const secret = generateTotpSecret();
      expect(verifyTotp(secret, '')).toBe(false);
      expect(verifyTotp(secret, 'abcdef')).toBe(false);
      expect(verifyTotp(secret, '12345')).toBe(false);
    });
  });

  describe('generateTotpSecret', () => {
    it('produces a non-trivial, unique base32 secret each call', () => {
      const a = generateTotpSecret();
      const b = generateTotpSecret();
      expect(a).not.toEqual(b);
      expect(a).toMatch(/^[A-Z2-7]+$/);
      expect(a.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('otpauthUrl', () => {
    it('builds a scannable provisioning URI', () => {
      const url = otpauthUrl({
        secret: 'JBSWY3DPEHPK3PXP',
        label: 'admin@asta.dev',
        issuer: 'Asta',
      });
      expect(url).toContain('otpauth://totp/Asta:admin%40asta.dev');
      expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
      expect(url).toContain('issuer=Asta');
      expect(url).toContain('algorithm=SHA1');
    });
  });
});
