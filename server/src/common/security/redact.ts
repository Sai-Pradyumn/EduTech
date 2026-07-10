/**
 * Privacy-safe logging helpers (SECURITY_IMPLEMENTATION.md §15, control DP-04, OWASP
 * Top 10:2025 A09). Redacts secrets/PII before anything reaches a log sink or an error
 * feed. Use {@link redact} on any object you are about to log, and {@link redactString}
 * on free-text lines (e.g. before persisting a message or stack).
 *
 * This is deny-biased: unknown-but-secret-looking keys are redacted rather than risk a
 * leak. It never mutates its input — callers get a safe copy.
 */

const REDACTED = '[REDACTED]';

/** Keys whose VALUE must never be logged, matched case-insensitively as a substring. */
const SENSITIVE_KEY =
  /pass(word|code)?|secret|token|authorization|auth[-_]?header|api[-_]?key|access[-_]?key|client[-_]?secret|private[-_]?key|refresh|cookie|session|otp|mfa|totp|credential|cvv|card[-_]?number|ssn|pin\b/i;

/** Bearer tokens and JWT-shaped blobs embedded in free text. */
const BEARER_RE = /\b(bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi;
const JWT_RE =
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\b/g;
const EMAIL_RE =
  /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const LONG_HEX_RE = /\b[a-f0-9]{32,}\b/gi;

/** Partially mask an email so logs stay useful for correlation without exposing the address. */
export function maskEmail(value: string): string {
  return value.replace(EMAIL_RE, (_m, first: string, domain: string) => {
    return `${first}***${domain}`;
  });
}

/** Redact secret-shaped substrings from a free-text line. */
export function redactString(value: string): string {
  return value
    .replace(BEARER_RE, '$1' + REDACTED)
    .replace(JWT_RE, REDACTED)
    .replace(LONG_HEX_RE, REDACTED)
    .replace(
      EMAIL_RE,
      (_m, first: string, domain: string) => `${first}***${domain}`,
    );
}

export interface RedactOptions {
  /** Stop descending past this depth (guards against deep/cyclic structures). Default 6. */
  maxDepth?: number;
  /** Truncate any string longer than this many chars. Default 2048. */
  maxStringLength?: number;
}

/**
 * Deep-copy `input`, replacing sensitive values with `[REDACTED]`, scrubbing secret-shaped
 * substrings from remaining strings, and truncating very long strings. Safe on cycles.
 */
export function redact<T>(input: T, opts: RedactOptions = {}): unknown {
  const maxDepth = opts.maxDepth ?? 6;
  const maxStringLength = opts.maxStringLength ?? 2048;
  const seen = new WeakSet<object>();

  const walk = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
      const scrubbed = redactString(value);
      return scrubbed.length > maxStringLength
        ? `${scrubbed.slice(0, maxStringLength)}…[truncated]`
        : scrubbed;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function') return '[Function]';

    if (depth >= maxDepth) return '[Truncated]';

    if (Array.isArray(value)) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      return value.map((item) => walk(item, depth + 1));
    }

    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactString(value.message),
      };
    }

    if (typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>,
      )) {
        out[key] = SENSITIVE_KEY.test(key) ? REDACTED : walk(val, depth + 1);
      }
      return out;
    }
    return value;
  };

  return walk(input, 0);
}
