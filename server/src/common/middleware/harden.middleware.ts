import { NextFunction, Request, Response } from 'express';
import { stripDangerousKeys } from '../security/sanitize';

/**
 * Request-hardening middleware bundle (SECURITY_IMPLEMENTATION.md §8/§10), applied globally
 * in main.ts. Each piece is small, dependency-free, and independently testable:
 *  - methodFilter: rejects diagnostic verbs (TRACE/TRACK) that can echo credentials (XST).
 *  - hpp: collapses duplicated query parameters (HTTP Parameter Pollution) so validators
 *    and handlers always see a single scalar, first value wins.
 *  - mongoSanitize: strips Mongo operator / prototype-pollution keys from parsed
 *    body & query — covers non-DTO surfaces the whitelist ValidationPipe doesn't reach.
 *  - originCheck: CSRF backstop — a state-changing request carrying a browser Origin
 *    header must come from our own SPA origin or the API's own host (Swagger). Requests
 *    without an Origin header (server-to-server: webhooks, curl, SDKs) are unaffected.
 *  - concurrencyLimit: load shedding — beyond N in-flight requests, shed with 503 +
 *    Retry-After instead of letting the event loop drown (availability under attack).
 */

const BLOCKED_METHODS = new Set(['TRACE', 'TRACK']);

export function methodFilter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (BLOCKED_METHODS.has(req.method.toUpperCase())) {
    res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
    });
    return;
  }
  next();
}

export function hpp(req: Request, _res: Response, next: NextFunction): void {
  const query = req.query as Record<string, unknown>;
  if (query && typeof query === 'object') {
    for (const key of Object.keys(query)) {
      const v = query[key];
      if (Array.isArray(v)) query[key] = v[0];
    }
  }
  next();
}

export function mongoSanitize(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body && typeof req.body === 'object') {
    req.body = stripDangerousKeys(req.body).cleaned;
  }
  const query = req.query as Record<string, unknown> | undefined;
  if (query && typeof query === 'object') {
    // req.query may be a lazy getter-backed object — mutate keys in place.
    const { cleaned } = stripDangerousKeys({ ...query });
    for (const key of Object.keys(query)) delete query[key];
    Object.assign(query, cleaned);
  }
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OriginCheckOptions {
  /** Full origins allowed to make state-changing browser requests (the SPA origin). */
  allowedOrigins: string[];
  enabled?: boolean;
}

export function originCheck(opts: OriginCheckOptions) {
  const allowed = new Set(opts.allowedOrigins.filter(Boolean));
  const enabled = opts.enabled ?? true;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled || SAFE_METHODS.has(req.method.toUpperCase())) return next();
    const origin = req.headers.origin;
    // No Origin header → not a cross-site browser request (webhooks, curl, SDKs). The
    // browser is the CSRF vector, and browsers always send Origin on cross-site writes.
    if (!origin) return next();
    if (allowed.has(origin)) return next();
    // Same-host (e.g. Swagger UI served by this API) is fine regardless of scheme.
    try {
      if (new URL(origin).host === req.headers.host) return next();
    } catch {
      /* malformed Origin falls through to rejection */
    }
    res.status(403).json({
      success: false,
      error: {
        code: 'ORIGIN_FORBIDDEN',
        message: 'Cross-origin request rejected.',
      },
    });
  };
}

export function concurrencyLimit(maxInflight: number) {
  let inflight = 0;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (maxInflight <= 0) return next(); // disabled
    if (inflight >= maxInflight) {
      res.setHeader('Retry-After', '1');
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVER_BUSY',
          message: 'Server is at capacity. Please retry shortly.',
        },
      });
      return;
    }
    inflight += 1;
    let done = false;
    const release = () => {
      if (!done) {
        done = true;
        inflight -= 1;
      }
    };
    res.on('finish', release);
    res.on('close', release);
    next();
  };
}
