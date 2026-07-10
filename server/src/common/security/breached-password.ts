import { createHash } from 'crypto';

/**
 * Breached-password screening (SECURITY_IMPLEMENTATION.md §6 · AU-05) via the
 * Have-I-Been-Pwned k-anonymity range API. Privacy property: the password — and even its
 * full hash — never leaves the server. We send only the FIRST 5 hex characters of the
 * SHA-1; the API returns every suffix in that bucket (~800 rows) and the match is checked
 * locally. Defensive control only: it stops users choosing passwords already circulating
 * in public breach corpora (NIST SP 800-63B §5.1.1.2 recommends exactly this screening).
 *
 * Fail-open by design: if the API is slow/unreachable, registration proceeds — availability
 * of signup must not depend on a third party. Enforcement is env-gated
 * (PASSWORD_BREACH_CHECK=true) so dev boxes without egress pay zero latency.
 */

export const HIBP_RANGE_BASE = 'https://api.pwnedpasswords.com/range/';

/** SHA-1 the password (uppercase hex) and split into the 5-char prefix + 35-char suffix. */
export function hashParts(password: string): {
  prefix: string;
  suffix: string;
} {
  const digest = createHash('sha1')
    .update(password, 'utf8')
    .digest('hex')
    .toUpperCase();
  return { prefix: digest.slice(0, 5), suffix: digest.slice(5) };
}

/**
 * Parse an HIBP range response body ("SUFFIX:COUNT\r\n" lines) and return the breach count
 * for the given suffix, or 0 when absent.
 */
export function countInRange(body: string, suffix: string): number {
  const target = suffix.toUpperCase();
  for (const line of body.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    if (line.slice(0, idx).trim().toUpperCase() === target) {
      const n = parseInt(line.slice(idx + 1).trim(), 10);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

export interface BreachCheckResult {
  /** True when the password appears in known breach data at/above the threshold. */
  breached: boolean;
  /** How many times it appears (0 when clean or when the check was skipped). */
  count: number;
  /** False when the API couldn't be reached and the check failed open. */
  checked: boolean;
}

export interface BreachCheckOptions {
  /** Minimum breach count to flag (default 1 — any appearance). */
  threshold?: number;
  /** Request timeout in ms (default 2500 — signup latency must stay bounded). */
  timeoutMs?: number;
  /** Injectable fetch for tests. */
  fetchFn?: typeof fetch;
}

/** Query the k-anonymity range API. Never throws — network trouble fails open. */
export async function checkBreachedPassword(
  password: string,
  opts: BreachCheckOptions = {},
): Promise<BreachCheckResult> {
  const threshold = opts.threshold ?? 1;
  const timeoutMs = opts.timeoutMs ?? 2500;
  const doFetch = opts.fetchFn ?? fetch;
  const { prefix, suffix } = hashParts(password);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(`${HIBP_RANGE_BASE}${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true' }, // response padding resists traffic analysis
    });
    if (!res.ok) return { breached: false, count: 0, checked: false };
    const body = await res.text();
    const count = countInRange(body, suffix);
    return { breached: count >= threshold, count, checked: true };
  } catch {
    return { breached: false, count: 0, checked: false };
  } finally {
    clearTimeout(timer);
  }
}
