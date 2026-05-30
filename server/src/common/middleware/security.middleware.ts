import { NextFunction, Request, Response } from 'express';

/**
 * Security headers (Phase 4 · B12) — a dependency-free, helmet-style baseline.
 * Applied globally in main.ts. CSP is intentionally omitted (SPA + inline styles);
 * tighten per-deployment behind a reverse proxy.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
  res.removeHeader('X-Powered-By');
  next();
}
