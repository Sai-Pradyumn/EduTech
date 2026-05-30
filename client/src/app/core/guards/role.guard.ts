import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models';

/** Restricts a route tree to a given role; redirects others to their home. */
export const roleGuard = (role: Role): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    if (user?.role === role) return true;
    if (user) return router.createUrlTree([auth.postAuthRoute(user)]);
    return router.createUrlTree(['/login']);
  };
};
