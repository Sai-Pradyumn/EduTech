import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Refresh-and-retry (fixes the P0 "expired token logs you out" crash). On a 401
 * from a protected request, transparently rotates the access token via the refresh
 * token and retries the original request once — so a stale token mid-session (or
 * after wake-from-sleep) recovers instead of dumping the user to /login. Concurrent
 * 401s share one refresh (see AuthService.refreshAccessToken). If the refresh
 * itself fails, the original 401 propagates and the errorInterceptor upstream
 * clears the session. Must sit AFTER errorInterceptor so this runs first on 401.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Never try to refresh the refresh call itself (infinite loop).
  if (req.url.includes('/auth/refresh')) return next(req);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only a 401 with a refresh token on hand is recoverable here.
      if (err.status !== 401 || !auth.refreshToken) return throwError(() => err);
      return auth.refreshAccessToken().pipe(
        switchMap((token) => next(withToken(req, token))),
        // Refresh failed → propagate the ORIGINAL 401 so errorInterceptor logs out.
        catchError(() => throwError(() => err)),
      );
    }),
  );
};
