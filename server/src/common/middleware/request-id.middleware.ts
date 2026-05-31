import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Request correlation (Phase 10 · M7). Attaches a stable `requestId` to every request and
 * echoes it as `X-Request-Id`, so logs, error responses and the admin error page can be
 * traced end to end. Honors an inbound `X-Request-Id` from a gateway/proxy when present.
 */
export interface RequestWithId extends Request {
  requestId?: string;
  startTime?: number;
}

export function requestId(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
  req.requestId = id;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', id);
  next();
}
