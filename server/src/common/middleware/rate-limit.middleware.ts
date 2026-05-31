import { NextFunction, Request, Response } from 'express';

/**
 * Lightweight in-memory rate limiter (Phase 4 · B12). Per-IP fixed window — no
 * external deps. Good enough for a single instance; swap for Redis-backed limiting
 * (or an API-gateway limiter) when scaling horizontally. Generous defaults so dev
 * is never blocked.
 */
interface Bucket {
  count: number;
  reset: number;
}

export function rateLimit(opts: { windowMs?: number; max?: number } = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 300;
  const buckets = new Map<string, Bucket>();

  // Periodic sweep so the map doesn't grow unbounded.
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.reset <= now) buckets.delete(key);
  }, windowMs).unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.ip || req.socket?.remoteAddress || 'unknown').toString();
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || b.reset <= now) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(ip, b);
    }
    b.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - b.count)));
    if (b.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
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
  };
}
