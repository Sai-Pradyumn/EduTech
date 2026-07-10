/**
 * Circuit breaker for outbound dependencies (SECURITY_IMPLEMENTATION.md §10 "safe
 * third-party integration handling"). When a dependency starts failing, keeping to hammer
 * it ties up sockets/event-loop time and turns their outage into ours (resource-exhaustion
 * amplification). After `failureThreshold` consecutive failures the circuit OPENS and
 * calls fail fast for `cooldownMs`; the next call after cooldown is a HALF-OPEN probe —
 * success closes the circuit, failure re-opens it. Pure logic with an injectable clock.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitOpenError extends Error {
  constructor(name: string, retryInMs: number) {
    super(
      `${name} is temporarily unavailable (circuit open; retry in ~${Math.ceil(retryInMs / 1000)}s)`,
    );
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the circuit. */
  failureThreshold?: number;
  /** How long to fail fast before probing again. */
  cooldownMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  private failures = 0;
  private openedAt: number | null = null;
  private probing = false;

  constructor(
    private readonly name: string,
    opts: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.cooldownMs = opts.cooldownMs ?? 30_000;
    this.now = opts.now ?? Date.now;
  }

  get state(): CircuitState {
    if (this.openedAt === null) return 'closed';
    return this.now() - this.openedAt >= this.cooldownMs ? 'half-open' : 'open';
  }

  /** Run `fn` through the breaker. Throws CircuitOpenError without calling `fn` when open. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.state;
    if (state === 'open') {
      throw new CircuitOpenError(
        this.name,
        this.cooldownMs - (this.now() - (this.openedAt ?? 0)),
      );
    }
    if (state === 'half-open') {
      // Only one probe at a time; concurrent callers fail fast instead of stampeding.
      if (this.probing) throw new CircuitOpenError(this.name, this.cooldownMs);
      this.probing = true;
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      this.probing = false;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.openedAt = this.now();
    }
  }
}

/** Keyed registry so each provider/endpoint gets its own independent circuit. */
export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(private readonly opts: CircuitBreakerOptions = {}) {}

  for(key: string): CircuitBreaker {
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = new CircuitBreaker(key, this.opts);
      this.breakers.set(key, breaker);
    }
    return breaker;
  }
}
