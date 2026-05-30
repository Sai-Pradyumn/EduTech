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
    req = req.clone({ setHeaders: headers });
  }
  return next(req);
};
