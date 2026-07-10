import { NextFunction, Request, Response } from 'express';
import {
  concurrencyLimit,
  hpp,
  methodFilter,
  mongoSanitize,
  originCheck,
} from './harden.middleware';

function makeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  let body: unknown;
  const listeners: Record<string, Array<() => void>> = {};
  const res = {
    headers,
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
    on: (event: string, cb: () => void) => {
      (listeners[event] ??= []).push(cb);
    },
    emit: (event: string) => (listeners[event] ?? []).forEach((cb) => cb()),
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
  return res;
}

function run(
  mw: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request>,
) {
  const res = makeRes();
  let nexted = false;
  mw(
    req as Request,
    res as unknown as Response,
    (() => {
      nexted = true;
    }) as NextFunction,
  );
  return { res, nexted };
}

describe('harden.middleware', () => {
  describe('methodFilter', () => {
    it('blocks TRACE/TRACK with 405 and passes normal verbs', () => {
      expect(run(methodFilter, { method: 'TRACE' }).res.statusCode).toBe(405);
      expect(run(methodFilter, { method: 'TRACK' }).res.statusCode).toBe(405);
      expect(run(methodFilter, { method: 'GET' }).nexted).toBe(true);
      expect(run(methodFilter, { method: 'POST' }).nexted).toBe(true);
    });
  });

  describe('hpp', () => {
    it('collapses duplicated query params to the first value', () => {
      const req = { query: { role: ['student', 'admin'], ok: 'x' } };
      const { nexted } = run(hpp, req);
      expect(nexted).toBe(true);
      expect(req.query.role).toBe('student');
      expect(req.query.ok).toBe('x');
    });
  });

  describe('mongoSanitize', () => {
    it('strips operator keys from body and query', () => {
      const req = {
        body: { email: { $gt: '' }, name: 'ok' },
        query: { $where: 'x', page: '1' },
      };
      const { nexted } = run(mongoSanitize, req);
      expect(nexted).toBe(true);
      expect(req.body).toEqual({ email: {}, name: 'ok' });
      expect(req.query).toEqual({ page: '1' });
    });

    it('leaves clean requests untouched', () => {
      const req = { body: { a: 1 }, query: { b: '2' } };
      run(mongoSanitize, req);
      expect(req.body).toEqual({ a: 1 });
      expect(req.query).toEqual({ b: '2' });
    });
  });

  describe('originCheck', () => {
    const mw = originCheck({ allowedOrigins: ['https://app.asta.dev'] });

    it('allows safe methods and same-origin writes', () => {
      expect(run(mw, { method: 'GET', headers: {} }).nexted).toBe(true);
      expect(
        run(mw, {
          method: 'POST',
          headers: { origin: 'https://app.asta.dev' },
        }).nexted,
      ).toBe(true);
    });

    it('allows writes with no Origin header (server-to-server webhooks/CLIs)', () => {
      expect(run(mw, { method: 'POST', headers: {} }).nexted).toBe(true);
    });

    it('allows the API host itself (Swagger UI)', () => {
      expect(
        run(mw, {
          method: 'POST',
          headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
        }).nexted,
      ).toBe(true);
    });

    it('rejects cross-site browser writes with 403', () => {
      const { res, nexted } = run(mw, {
        method: 'POST',
        headers: { origin: 'https://evil.example', host: 'api.asta.dev' },
      });
      expect(nexted).toBe(false);
      expect(res.statusCode).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        'ORIGIN_FORBIDDEN',
      );
    });

    it('rejects malformed Origin values', () => {
      const { res } = run(mw, {
        method: 'DELETE',
        headers: { origin: 'not a url', host: 'api.asta.dev' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('can be disabled via the flag', () => {
      const off = originCheck({ allowedOrigins: [], enabled: false });
      expect(
        run(off, {
          method: 'POST',
          headers: { origin: 'https://evil.example' },
        }).nexted,
      ).toBe(true);
    });
  });

  describe('concurrencyLimit', () => {
    it('sheds load past the cap and recovers when requests finish', () => {
      const mw = concurrencyLimit(2);
      const r1 = run(mw, { method: 'GET' });
      const r2 = run(mw, { method: 'GET' });
      const r3 = run(mw, { method: 'GET' });
      expect(r1.nexted && r2.nexted).toBe(true);
      expect(r3.nexted).toBe(false);
      expect(r3.res.statusCode).toBe(503);
      expect(r3.res.headers['retry-after']).toBe('1');

      // Finish one in-flight request → capacity is available again.
      r1.res.emit('finish');
      const r4 = run(mw, { method: 'GET' });
      expect(r4.nexted).toBe(true);
    });

    it('is a no-op when the cap is 0 (disabled)', () => {
      const mw = concurrencyLimit(0);
      for (let i = 0; i < 5; i++) {
        expect(run(mw, { method: 'GET' }).nexted).toBe(true);
      }
    });

    it('does not double-release on finish + close', () => {
      const mw = concurrencyLimit(1);
      const r1 = run(mw, { method: 'GET' });
      r1.res.emit('finish');
      r1.res.emit('close');
      const r2 = run(mw, { method: 'GET' });
      const r3 = run(mw, { method: 'GET' });
      expect(r2.nexted).toBe(true);
      expect(r3.nexted).toBe(false); // capacity is 1, not 2
    });
  });
});
