import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * RFC 4226 (HOTP) / RFC 6238 (TOTP) — a dependency-free, standards-compliant
 * one-time-password primitive used for admin MFA (SECURITY_IMPLEMENTATION.md §6/§17,
 * control AU-03). Compatible with Google Authenticator / Authy / 1Password (base32
 * secret, SHA1, 6 digits, 30s step). Correctness is pinned to the RFC 6238 Appendix B
 * test vectors in totp.spec.ts — do not "optimise" the truncation without re-running them.
 *
 * We hand-roll this on top of node:crypto rather than add a dependency: the algorithm is
 * a small, fixed, spec-defined function, and a vendored implementation we can read end to
 * end is a smaller supply-chain surface than another package (OWASP Top 10:2025 A03).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 (no padding) — the encoding authenticator apps expect for the secret. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character in secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * HOTP (RFC 4226): HMAC-SHA1 of the 8-byte big-endian counter, dynamically truncated to
 * `digits` decimal digits. Exposed so tests can drive it with the RFC's raw ASCII key.
 */
export function hotp(key: Buffer, counter: number, digits = 6): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(Math.floor(counter)));
  const digest = createHmac('sha1', key).update(counterBuf).digest();

  // Dynamic truncation (RFC 4226 §5.3): low nibble of the last byte selects the offset.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export interface TotpOptions {
  /** Time step in seconds (RFC default 30). */
  step?: number;
  /** Epoch offset T0 in seconds (RFC default 0). */
  t0?: number;
  /** Number of digits (authenticator apps use 6). */
  digits?: number;
  /** Override "now" (ms since epoch) — for tests / deterministic behaviour. */
  timeMs?: number;
}

/** TOTP (RFC 6238): HOTP with the counter derived from the current time window. */
export function totp(secretBase32: string, opts: TotpOptions = {}): string {
  const step = opts.step ?? 30;
  const t0 = opts.t0 ?? 0;
  const digits = opts.digits ?? 6;
  const nowSec = Math.floor((opts.timeMs ?? Date.now()) / 1000);
  const counter = Math.floor((nowSec - t0) / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

export interface TotpVerifyOptions extends TotpOptions {
  /**
   * How many steps of clock drift to accept on each side (default 1 → ±30s). Keep small;
   * a large window trades brute-force resistance for tolerance.
   */
  window?: number;
}

/** Constant-time compare of two equal-length ASCII codes. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verify a user-supplied token against the secret, tolerating small clock drift. Uses a
 * constant-time comparison so a timing side-channel can't leak digits.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  opts: TotpVerifyOptions = {},
): boolean {
  const step = opts.step ?? 30;
  const t0 = opts.t0 ?? 0;
  const digits = opts.digits ?? 6;
  const window = opts.window ?? 1;
  const cleaned = (token ?? '').replace(/\s+/g, '');
  if (!/^\d+$/.test(cleaned) || cleaned.length !== digits) return false;

  const key = base32Decode(secretBase32);
  const nowSec = Math.floor((opts.timeMs ?? Date.now()) / 1000);
  const counter = Math.floor((nowSec - t0) / step);

  let matched = false;
  // Walk the whole window even after a hit so total work is constant regardless of position.
  for (let error = -window; error <= window; error++) {
    if (safeEqual(hotp(key, counter + error, digits), cleaned)) matched = true;
  }
  return matched;
}

/** Generate a fresh, random base32 TOTP secret (160 bits by default, per RFC 4226). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export interface OtpAuthParams {
  secret: string;
  /** Account label, e.g. the user's email. */
  label: string;
  /** Issuer shown in the authenticator app. */
  issuer: string;
  digits?: number;
  step?: number;
}

/**
 * Build the `otpauth://` provisioning URI the client renders as a QR code. The secret is
 * sensitive — this URI must only be returned to the enrolling, authenticated user over TLS
 * and never logged.
 */
export function otpauthUrl({
  secret,
  label,
  issuer,
  digits = 6,
  step = 30,
}: OtpAuthParams): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(step),
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    label,
  )}?${params.toString()}`;
}
