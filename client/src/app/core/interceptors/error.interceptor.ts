import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/** Maps the error envelope to toasts; on 401 clears the session and redirects. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message =
        (err.error && typeof err.error === 'object' && err.error.error?.message) ||
        err.message ||
        'Network error';

      if (err.status === 401 && !req.url.includes('/auth/')) {
        auth.clearSession();
        void router.navigate(['/login']);
      } else if (err.status === 0) {
        toast.error('Cannot reach the server. Is the API running?');
      } else if (req.method !== 'GET') {
        // Surface mutating-request failures; GET errors are handled inline by views.
        toast.error(message);
      }

      return throwError(() => err);
    }),
  );
};
