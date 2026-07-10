import { NextFunction, Request, Response } from 'express';

/**
 * Security headers (Phase 4 · B12) — a dependency-free, helmet-style baseline.
 * Applied globally in main.ts. See SECURITY_IMPLEMENTATION.md §9 (control FE-01).
 *
 * This API returns JSON, so it carries a **locked-down** CSP (`default-src 'none'`) that
 * neutralises any HTML ever reflected in an error/response — a browser will run nothing
 * from it. The Swagger UI at `/api/docs` is the one HTML surface the API serves, so it is
 * exempted from the strict CSP (it needs its own inline script/style). The SPA has its own,
 * richer CSP at the edge (vercel.json).
 */

/** Paths that render HTML from the API and therefore can't use the JSON-API CSP. */
function servesHtml(url: string): boolean {
  return url.startsWith('/api/docs');
}

export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // Isolate our resources from cross-origin embedding (defence-in-depth for API responses).
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // HSTS: pin clients to HTTPS for 180 days. Inert over plain HTTP (dev), so it's
  // safe to send unconditionally; meaningful once served behind TLS in production.
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=15552000; includeSubDomains',
  );
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(self)',
  );

  // Legacy Flash/PDF cross-domain policy files — explicitly deny.
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // CORS responses vary by caller origin — prevent cache poisoning at intermediaries.
  res.setHeader('Vary', 'Origin');

  // A JSON API should never be a source of executable content: `default-src 'none'`
  // means a browser will neither run scripts nor load subresources from an API response.
  if (!servesHtml(req.originalUrl ?? req.url)) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    // API responses carry per-user data — no shared cache or disk cache may retain them.
    res.setHeader('Cache-Control', 'no-store');
  }

  res.removeHeader('X-Powered-By');
  next();
}
