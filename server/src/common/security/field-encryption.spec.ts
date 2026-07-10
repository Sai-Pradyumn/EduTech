import { randomBytes } from 'crypto';
import {
  decryptField,
  encryptField,
  isEncryptedField,
  needsReencryption,
  parseKeyRing,
} from './field-encryption';

describe('security/field-encryption', () => {
  const keyB64 = randomBytes(32).toString('base64');

  describe('parseKeyRing', () => {
    it('accepts a single bare key as version 1', () => {
      const ring = parseKeyRing(keyB64);
      expect(ring.current).toBe(1);
      expect(ring.keys.get(1)?.length).toBe(32);
    });

    it('parses versioned keys and picks the highest as current', () => {
      const ring = parseKeyRing(
        `1:${keyB64},3:${randomBytes(32).toString('base64')}`,
      );
      expect(ring.current).toBe(3);
      expect(ring.keys.size).toBe(2);
    });

    it('stretches a passphrase to 32 bytes', () => {
      const ring = parseKeyRing('dev-passphrase-not-for-prod');
      expect(ring.keys.get(1)?.length).toBe(32);
    });

    it('rejects multiple keys without version prefixes', () => {
      expect(() => parseKeyRing(`${keyB64},${keyB64}`)).toThrow();
    });

    it('rejects an empty spec', () => {
      expect(() => parseKeyRing('')).toThrow();
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    const ring = parseKeyRing(keyB64);

    it('round-trips plaintext, including unicode', () => {
      for (const pt of ['secret-value', 'खाता १२३ · émail@例.com', '']) {
        expect(decryptField(encryptField(pt, ring), ring)).toBe(pt);
      }
    });

    it('produces a fresh IV every call (no ciphertext reuse)', () => {
      const a = encryptField('same', ring);
      const b = encryptField('same', ring);
      expect(a).not.toEqual(b);
    });

    it('fails closed on ciphertext tampering (GCM auth)', () => {
      const env = encryptField('important', ring);
      const parts = env.split(':');
      // Flip a character in the ciphertext segment.
      const ct = parts[3];
      parts[3] = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
      expect(() => decryptField(parts.join(':'), ring)).toThrow();
    });

    it('rejects a malformed envelope', () => {
      expect(() => decryptField('not-an-envelope', ring)).toThrow(/envelope/i);
    });
  });

  describe('key rotation', () => {
    it('decrypts old-version envelopes and encrypts with the current key', () => {
      const oldRing = parseKeyRing(`1:${keyB64}`);
      const envelope = encryptField('rotate-me', oldRing);

      const newKey = randomBytes(32).toString('base64');
      const ring2 = parseKeyRing(`1:${keyB64},2:${newKey}`);

      // Old data still readable; new writes use v2; old envelope flagged for re-encryption.
      expect(decryptField(envelope, ring2)).toBe('rotate-me');
      expect(encryptField('fresh', ring2)).toMatch(/^v2:/);
      expect(needsReencryption(envelope, ring2)).toBe(true);
      expect(needsReencryption(encryptField('fresh', ring2), ring2)).toBe(
        false,
      );
    });

    it('throws a clear error when the named key version is missing', () => {
      const ringA = parseKeyRing(`2:${keyB64}`);
      const env = encryptField('x', ringA);
      const ringB = parseKeyRing(`3:${randomBytes(32).toString('base64')}`);
      expect(() => decryptField(env, ringB)).toThrow(/v2/);
    });
  });

  describe('isEncryptedField', () => {
    it('detects envelopes vs plaintext', () => {
      const ring = parseKeyRing(keyB64);
      expect(isEncryptedField(encryptField('x', ring))).toBe(true);
      expect(isEncryptedField('plain old value')).toBe(false);
    });
  });
});
