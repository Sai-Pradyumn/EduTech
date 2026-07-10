import { createHash, timingSafeEqual } from 'crypto';

/**
 * Input/identifier sanitization primitives (SECURITY_IMPLEMENTATION.md §10):
 *  - stripDangerousKeys: removes MongoDB operator keys ($gt, $where, dotted paths) and
 *    prototype-pollution vectors (__proto__/constructor/prototype) from parsed input —
 *    the whitelist ValidationPipe covers DTO routes; this covers everything else
 *    (query strings, free-form metadata objects, webhook payloads).
 *  - sanitizeLogValue: neutralizes log-injection (CRLF forging) in user-controlled strings
 *    that end up in structured logs.
 *  - sanitizeFilename: collapses a user-supplied filename to a safe basename.
 *  - safeCompare: constant-time string equality for secrets (API keys, signatures).
 */

const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 32;

// Control characters (C0 + DEL), written as escapes so no literal bytes live in source.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');

export interface StripResult<T> {
  cleaned: T;
  /** Key paths that were removed — log these (they indicate probing). */
  removed: string[];
}

function isDangerousKey(key: string): boolean {
  return key.startsWith('$') || key.includes('.') || PROTO_KEYS.has(key);
}

/**
 * Deep-copy `value` with operator/prototype keys removed. Non-objects pass through.
 * Never mutates its input; cycle- and depth-safe.
 */
export function stripDangerousKeys<T>(value: T): StripResult<T> {
  const removed: string[] = [];
  const seen = new WeakSet<object>();

  const walk = (v: unknown, path: string, depth: number): unknown => {
    if (v === null || typeof v !== 'object' || depth > MAX_DEPTH) return v;
    if (seen.has(v)) return undefined;
    seen.add(v);

    if (Array.isArray(v)) {
      return v.map((item, i) => walk(item, `${path}[${i}]`, depth + 1));
    }
    if (v instanceof Date || Buffer.isBuffer(v)) return v;

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      if (isDangerousKey(key)) {
        removed.push(path ? `${path}.${key}` : key);
        continue;
      }
      out[key] = walk(val, path ? `${path}.${key}` : key, depth + 1);
    }
    return out;
  };

  return { cleaned: walk(value, '', 0) as T, removed };
}

/**
 * Make a user-controlled string safe to embed in a log line: strips CR/LF and control
 * characters (log forging / terminal-escape injection) and caps the length.
 */
export function sanitizeLogValue(value: unknown, maxLen = 512): string {
  const s = String(value ?? '');
  const cleaned = s.replace(CONTROL_CHARS, ' ');
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}...` : cleaned;
}

/** Windows reserved device names that must not be used as filenames. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Reduce a user-supplied filename to a safe basename: no path separators, no control
 * characters, no leading dots (hidden/relative tricks), bounded length. Never returns an
 * empty string. Storage keys should still be random — this is for display/metadata.
 */
export function sanitizeFilename(name: unknown, maxLen = 120): string {
  let s = String(name ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/\.\.[/\\]/g, '') // drop traversal segments ("../", "..\") entirely
    .replace(/[/\\]+/g, '_') // remaining path separators
    .replace(/[<>:"|?*]/g, '_') // Windows-illegal characters
    .replace(/^\.+/, '') // leading dots (".." / hidden files)
    .trim();
  if (RESERVED_NAMES.test(s)) s = `_${s}`;
  if (s.length > maxLen) {
    // Keep the extension when truncating so the type stays recognizable.
    const dot = s.lastIndexOf('.');
    const ext = dot > 0 && s.length - dot <= 12 ? s.slice(dot) : '';
    s = s.slice(0, maxLen - ext.length) + ext;
  }
  return s || 'file';
}

/**
 * Constant-time string comparison for secrets. Hashes both sides first so inputs of
 * different lengths compare in constant time too (timingSafeEqual requires equal length).
 */
export function safeCompare(a: string, b: string): boolean {
  const ha = createHash('sha256')
    .update(a ?? '')
    .digest();
  const hb = createHash('sha256')
    .update(b ?? '')
    .digest();
  return timingSafeEqual(ha, hb);
}
