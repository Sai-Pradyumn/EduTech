import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Attaches the access token to API requests. */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken;
  if (token && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    // Tenant scope: the active organization the user is operating in.
    const orgId = localStorage.getItem('asta.activeOrg');
    if (orgId) headers['x-org-id'] = orgId;
    // Wall-clock scope: anchors server "today"/streak/day boundaries to the
    // learner's timezone (their saved preference, else the browser's zone).
    try {
      const tz =
        localStorage.getItem('asta.tz') ||
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) headers['x-timezone'] = tz;
    } catch {
      /* Intl/localStorage unavailable — server falls back to UTC */
    }
    req = req.clone({ setHeaders: headers });
  }
  return next(req);
};
