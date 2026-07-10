import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Egress canary (SECURITY_IMPLEMENTATION.md §10 "output safety" · DP-04): a last line of
 * defense that strips credential-bearing fields from any JSON response before it leaves
 * the process, and logs loudly when it had to — because that means a handler returned a
 * raw document instead of a DTO/projection and should be fixed.
 *
 * Scope is deliberately narrow and unambiguous: only fields that are NEVER legitimate in a
 * response (password/refresh/MFA material). Walks plain objects/arrays only — Mongoose
 * documents serialize through their schema (where these fields are select:false already).
 */

const FORBIDDEN_KEYS = new Set([
  'passwordHash',
  'refreshTokenHash',
  'mfaSecret',
  'mfaRecoveryHashes',
  'codeHash',
]);

const MAX_DEPTH = 10;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

/** Recursively delete forbidden keys in place; returns the paths it removed. */
export function scrubSecrets(value: unknown): string[] {
  const removed: string[] = [];
  const seen = new WeakSet<object>();

  const walk = (v: unknown, path: string, depth: number): void => {
    if (v === null || typeof v !== 'object' || depth > MAX_DEPTH) return;
    if (seen.has(v)) return;
    seen.add(v);

    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    if (!isPlainObject(v)) return;

    for (const key of Object.keys(v)) {
      if (FORBIDDEN_KEYS.has(key)) {
        delete v[key];
        removed.push(path ? `${path}.${key}` : key);
      } else {
        walk(v[key], path ? `${path}.${key}` : key, depth + 1);
      }
    }
  };

  walk(value, '', 0);
  return removed;
}

@Injectable()
export class SecretLeakInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecretLeakInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        const removed = scrubSecrets(data);
        if (removed.length > 0) {
          const handler = `${context.getClass().name}.${context.getHandler().name}`;
          // This firing is itself a bug report: the handler leaked credential fields.
          this.logger.warn(
            `Egress canary stripped secret field(s) from ${handler}: ${removed.join(', ')} — return a DTO/projection instead.`,
          );
        }
        return data;
      }),
    );
  }
}
