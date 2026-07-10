import { NextFunction, Request, Response } from 'express';

/**
 * Per-IP fixed-window rate limiter (Phase 4 · B12; SECURITY_IMPLEMENTATION.md §8 · API-02)
 * with a pluggable counter store:
 *   - MemoryRateLimitStore (default): zero deps, correct for a single instance.
 *   - RedisRateLimitStore: cluster-wide counting when running multiple instances
 *     (RATE_LIMIT_REDIS=true in main.ts). Fails open to a per-instance memory store if
 *     Redis is unreachable — degraded protection beats an outage, and the failure is logged.
 * Generous defaults so dev is never blocked.
 */

export interface RateLimitHit {
  count: number;
  /** Epoch ms when this key's window resets. */
  resetMs: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
}

interface Bucket {
  count: number;
  reset: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(sweepMs = 60_000) {
    // Periodic sweep so the map doesn't grow unbounded.
    setInterval(() => {
      const now = Date.now();
      for (const [key, b] of this.buckets)
        if (b.reset <= now) this.buckets.delete(key);
    }, sweepMs).unref?.();
  }

  hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || b.reset <= now) {
      b = { count: 0, reset: now + windowMs };
      this.buckets.set(key, b);
    }
    b.count += 1;
    return Promise.resolve({ count: b.count, resetMs: b.reset });
  }
}

/** The subset of an ioredis client the Redis store needs (keeps tests dependency-free). */
export interface RedisLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly fallback = new MemoryRateLimitStore();
  private warned = false;

  constructor(
    private readonly redis: RedisLike,
    /** Key namespace so limiter keys can't collide with app data. */
    private readonly prefix = 'rl:',
    private readonly log: (msg: string) => void = () => undefined,
  ) {}

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const k = this.prefix + key;
    try {
      const count = await this.redis.incr(k);
      // First hit in the window owns setting the expiry.
      if (count === 1) await this.redis.pexpire(k, windowMs);
      let ttl = await this.redis.pttl(k);
      // A key can lose its TTL (e.g. crash between INCR and PEXPIRE) — self-heal it so
      // the counter can't become a permanent block.
      if (ttl < 0) {
        await this.redis.pexpire(k, windowMs);
        ttl = windowMs;
      }
      return { count, resetMs: Date.now() + ttl };
    } catch (err) {
      if (!this.warned) {
        this.warned = true;
        this.log(
          `Redis rate-limit store unavailable (${(err as Error).message}); falling back to per-instance memory limits.`,
        );
      }
      return this.fallback.hit(key, windowMs);
    }
  }
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  /** Shared counter store; defaults to a fresh in-memory store per limiter. */
  store?: RateLimitStore;
}

export function rateLimit(opts: RateLimitOptions = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 300;
  const store = opts.store ?? new MemoryRateLimitStore(windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.ip || req.socket?.remoteAddress || 'unknown').toString();
    // Scope the key by route budget so the auth limiter and the global limiter count
    // independently even when they share one Redis store.
    const key = `${req.baseUrl || ''}|${max}|${ip}`;
    void store
      .hit(key, windowMs)
      .then(({ count, resetMs }) => {
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader(
          'X-RateLimit-Remaining',
          String(Math.max(0, max - count)),
        );
        if (count > max) {
          res.setHeader(
            'Retry-After',
            String(Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))),
          );
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please slow down.',
            },
          });
          return;
        }
        next();
      })
      .catch(() => next()); // never let the limiter itself take the API down
  };
}
