import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Field-level encryption for Restricted data (SECURITY_IMPLEMENTATION.md §11 · DP-03).
 * AES-256-GCM (authenticated encryption): tampering with the ciphertext, IV, or tag fails
 * decryption instead of returning garbage. Use for individual sensitive fields (e.g. MFA
 * secrets, OAuth refresh tokens, government IDs) on top of the provider's at-rest
 * encryption — so a leaked DB dump alone doesn't expose them.
 *
 * Envelope format (versioned for rotation):  v<keyVersion>:<iv b64>:<tag b64>:<ct b64>
 *  - Keys come from FIELD_ENCRYPTION_KEYS ("1:<base64-32-bytes>,2:<base64-32-bytes>").
 *  - Encryption always uses the highest version; decryption picks the version named in the
 *    envelope — so rotation is: add key N+1, re-encrypt lazily on write, retire old key
 *    once no envelope references it.
 *  - A raw passphrase (not 32 bytes of base64) is accepted and stretched via SHA-256; fine
 *    for dev, use a real random 256-bit key in production (KMS/secret manager).
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce size
const ENVELOPE_RE =
  /^v(\d+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)$/;

export interface KeyRing {
  /** version → 32-byte key */
  keys: Map<number, Buffer>;
  current: number;
}

/** Derive a 32-byte key from config material (base64 of 32 bytes, or a stretched passphrase). */
function toKey(material: string): Buffer {
  const trimmed = material.trim();
  const decoded = Buffer.from(trimmed, 'base64');
  if (decoded.length === 32 && decoded.toString('base64') === trimmed) {
    return decoded;
  }
  return createHash('sha256').update(trimmed, 'utf8').digest();
}

/**
 * Parse FIELD_ENCRYPTION_KEYS ("1:keyA,2:keyB") into a key ring. A single bare value (no
 * "n:" prefix) is treated as version 1 so simple setups need no ceremony.
 */
export function parseKeyRing(spec: string): KeyRing {
  const keys = new Map<number, Buffer>();
  const parts = spec
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0)
    throw new Error('No field-encryption keys configured');

  for (const part of parts) {
    const m = /^(\d+):(.+)$/.exec(part);
    if (m) {
      keys.set(Number(m[1]), toKey(m[2]));
    } else if (parts.length === 1) {
      keys.set(1, toKey(part));
    } else {
      throw new Error(
        'Multiple field-encryption keys must be version-prefixed ("1:key,2:key")',
      );
    }
  }
  return { keys, current: Math.max(...keys.keys()) };
}

/** Encrypt a UTF-8 string into a versioned envelope using the ring's current key. */
export function encryptField(plaintext: string, ring: KeyRing): string {
  const key = ring.keys.get(ring.current);
  if (!key) throw new Error(`Missing encryption key v${ring.current}`);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${ring.current}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** Decrypt an envelope, selecting the key version it names. Throws on tampering. */
export function decryptField(envelope: string, ring: KeyRing): string {
  const m = ENVELOPE_RE.exec(envelope);
  if (!m) throw new Error('Invalid encrypted-field envelope');
  const version = Number(m[1]);
  const key = ring.keys.get(version);
  if (!key)
    throw new Error(
      `No key configured for encrypted-field version v${version}`,
    );
  const iv = Buffer.from(m[2], 'base64');
  const tag = Buffer.from(m[3], 'base64');
  const ct = Buffer.from(m[4], 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    'utf8',
  );
}

/** True if the value is already an encrypted envelope (safe for idempotent writes). */
export function isEncryptedField(value: string): boolean {
  return ENVELOPE_RE.test(value);
}

/** True if the envelope was written with an older key and should be re-encrypted on write. */
export function needsReencryption(envelope: string, ring: KeyRing): boolean {
  const m = ENVELOPE_RE.exec(envelope);
  if (!m) return false;
  return Number(m[1]) < ring.current;
}
