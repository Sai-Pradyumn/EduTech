import { NextFunction, Request, Response } from 'express';
import { securityHeaders } from './security.middleware';

/** A minimal Response double that records headers. */
function mockRes(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    removeHeader(k: string) {
      delete headers[k.toLowerCase()];
    },
  };
  return res as unknown as Response & { headers: Record<string, string> };
}

function run(url: string) {
  const res = mockRes();
  const next = jest.fn() as unknown as NextFunction;
  securityHeaders({ originalUrl: url, url } as Request, res, next);
  return { res, next };
}

describe('securityHeaders middleware', () => {
  it('sets the core hardening headers and strips X-Powered-By', () => {
    const { res, next } = run('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('applies a locked-down CSP and no-store caching to JSON API responses', () => {
    const { res } = run('/api/users/me');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(res.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sets cross-domain-policy denial and Vary: Origin', () => {
    const { res } = run('/api/health');
    expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
    expect(res.headers['vary']).toBe('Origin');
  });

  it('exempts the Swagger docs HTML surface from the strict CSP and no-store', () => {
    const { res } = run('/api/docs');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['cache-control']).toBeUndefined();
  });
});
