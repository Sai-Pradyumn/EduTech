import { NextFunction, Request, Response } from 'express';
import {
  MemoryRateLimitStore,
  RedisLike,
  RedisRateLimitStore,
  rateLimit,
} from './rate-limit.middleware';

/** Minimal ioredis stand-in with real INCR/PEXPIRE/PTTL semantics. */
class FakeRedis implements RedisLike {
  data = new Map<string, { value: number; expiresAt: number | null }>();
  failing = false;

  async incr(key: string): Promise<number> {
    if (this.failing) throw new Error('connection refused');
    const now = Date.now();
    let e = this.data.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= now) e = undefined;
    const next = {
      value: (e?.value ?? 0) + 1,
      expiresAt: e?.expiresAt ?? null,
    };
    this.data.set(key, next);
    return next.value;
  }
  async pexpire(key: string, ms: number): Promise<number> {
    if (this.failing) throw new Error('connection refused');
    const e = this.data.get(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + ms;
    return 1;
  }
  async pttl(key: string): Promise<number> {
    if (this.failing) throw new Error('connection refused');
    const e = this.data.get(key);
    if (!e) return -2;
    if (e.expiresAt === null) return -1;
    return Math.max(0, e.expiresAt - Date.now());
  }
}

describe('rate-limit stores', () => {
  describe('MemoryRateLimitStore', () => {
    it('counts hits within a window and resets after it', async () => {
      const store = new MemoryRateLimitStore();
      const first = await store.hit('k', 50);
      const second = await store.hit('k', 50);
      expect(first.count).toBe(1);
      expect(second.count).toBe(2);

      await new Promise((r) => setTimeout(r, 60));
      const after = await store.hit('k', 50);
      expect(after.count).toBe(1);
    });

    it('tracks keys independently', async () => {
      const store = new MemoryRateLimitStore();
      await store.hit('a', 1000);
      const b = await store.hit('b', 1000);
      expect(b.count).toBe(1);
    });
  });

  describe('RedisRateLimitStore', () => {
    it('increments cluster-wide counters and sets the window expiry once', async () => {
      const redis = new FakeRedis();
      const store = new RedisRateLimitStore(redis);
      const h1 = await store.hit('ip1', 1000);
      const h2 = await store.hit('ip1', 1000);
      expect(h1.count).toBe(1);
      expect(h2.count).toBe(2);
      expect(redis.data.get('rl:ip1')?.expiresAt).not.toBeNull();
      expect(h2.resetMs).toBeGreaterThan(Date.now() - 5);
    });

    it('self-heals a key that lost its TTL', async () => {
      const redis = new FakeRedis();
      const store = new RedisRateLimitStore(redis);
      await store.hit('ip1', 1000);
      redis.data.get('rl:ip1')!.expiresAt = null; // simulate crash between INCR and PEXPIRE
      await store.hit('ip1', 1000);
      expect(redis.data.get('rl:ip1')?.expiresAt).not.toBeNull();
    });

    it('fails open to the memory fallback when Redis is down, and logs once', async () => {
      const redis = new FakeRedis();
      redis.failing = true;
      const logs: string[] = [];
      const store = new RedisRateLimitStore(redis, 'rl:', (m) => logs.push(m));

      const h1 = await store.hit('ip1', 1000);
      const h2 = await store.hit('ip1', 1000);
      expect(h1.count).toBe(1);
      expect(h2.count).toBe(2); // still counting, just per-instance
      expect(logs).toHaveLength(1);
    });
  });
});

describe('rateLimit middleware', () => {
  function makeRes() {
    const headers: Record<string, string> = {};
    let statusCode = 0;
    let body: unknown;
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
      status: (c: number) => {
        statusCode = c;
        return res;
      },
      json: (b: unknown) => {
        body = b;
      },
      get statusCode() {
        return statusCode;
      },
      get body() {
        return body;
      },
      headers,
    };
    return res;
  }

  function makeReq(ip = '1.2.3.4'): Request {
    return { ip, baseUrl: '', socket: {} } as unknown as Request;
  }

  it('allows under the limit and returns 429 with Retry-After past it', async () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2 });
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      let called = false;
      mw(
        makeReq(),
        res as unknown as Response,
        (() => {
          called = true;
        }) as NextFunction,
      );
      await new Promise((r) => setImmediate(r));
      results.push(called);
      if (i === 2) {
        expect(res.statusCode).toBe(429);
        expect(res.headers['retry-after']).toBeDefined();
        expect((res.body as { error: { code: string } }).error.code).toBe(
          'RATE_LIMITED',
        );
      }
    }
    expect(results).toEqual([true, true, false]);
  });

  it('keeps budgets separate per IP', async () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 });
    const resA = makeRes();
    const resB = makeRes();
    let aOk = false;
    let bOk = false;
    mw(
      makeReq('1.1.1.1'),
      resA as unknown as Response,
      (() => {
        aOk = true;
      }) as NextFunction,
    );
    mw(
      makeReq('2.2.2.2'),
      resB as unknown as Response,
      (() => {
        bOk = true;
      }) as NextFunction,
    );
    await new Promise((r) => setImmediate(r));
    expect(aOk).toBe(true);
    expect(bOk).toBe(true);
  });
});
