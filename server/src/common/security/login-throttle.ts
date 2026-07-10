/**
 * Per-account login throttling (SECURITY_IMPLEMENTATION.md §6, control AU-04). Complements
 * the per-IP limiter in main.ts: that caps volume from one source, this caps guessing
 * against one account regardless of source rotation (credential stuffing / distributed
 * brute force).
 *
 * Design notes:
 *  - Locks are TIME-BASED and self-healing (max 15 min), never permanent — a permanent lock
 *    would hand an attacker a trivial account-lockout DoS against a victim.
 *  - Backoff is exponential once the threshold is crossed, so the cost of guessing grows
 *    fast while a genuine user who mistypes a couple of times is barely inconvenienced.
 * Pure functions only — no clock, no DB — so the policy is unit-testable in isolation.
 */

export interface ThrottleConfig {
  /** Failed attempts allowed before the first lock kicks in. */
  maxAttempts: number;
  /** Lock duration applied when the threshold is first crossed. */
  baseLockMs: number;
  /** Upper bound on lock duration, no matter how many failures accrue. */
  maxLockMs: number;
}

export const DEFAULT_THROTTLE: ThrottleConfig = {
  maxAttempts: 5,
  baseLockMs: 60_000, // 1 minute
  maxLockMs: 15 * 60_000, // 15 minutes
};

export interface LockDecision {
  locked: boolean;
  lockedUntilMs: number | null;
  retryAfterSec: number;
}

/** Whether an account with the given `lockedUntil` is currently locked at `nowMs`. */
export function lockState(
  lockedUntilMs: number | null | undefined,
  nowMs: number,
): LockDecision {
  if (lockedUntilMs && lockedUntilMs > nowMs) {
    return {
      locked: true,
      lockedUntilMs,
      retryAfterSec: Math.ceil((lockedUntilMs - nowMs) / 1000),
    };
  }
  return { locked: false, lockedUntilMs: null, retryAfterSec: 0 };
}

export interface ThrottleUpdate {
  attempts: number;
  lockedUntilMs: number | null;
}

/**
 * Compute the new throttle state after a failed login. Returns the incremented attempt
 * count and, once the threshold is crossed, an exponentially-backed-off lock expiry.
 */
export function registerFailure(
  prevAttempts: number,
  nowMs: number,
  cfg: ThrottleConfig = DEFAULT_THROTTLE,
): ThrottleUpdate {
  const attempts = Math.max(0, prevAttempts) + 1;
  if (attempts < cfg.maxAttempts) {
    return { attempts, lockedUntilMs: null };
  }
  const over = attempts - cfg.maxAttempts; // 0 on the attempt that first hits the threshold
  const duration = Math.min(cfg.maxLockMs, cfg.baseLockMs * 2 ** over);
  return { attempts, lockedUntilMs: nowMs + duration };
}
