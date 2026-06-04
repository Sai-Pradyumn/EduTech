import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AstaModeService } from '../services/asta-mode.service';

/**
 * Sends the `/app` root to the surface that matches the learner's chosen mode:
 * Asta OS → `/app/os`, Classic → `/app/dashboard`. Replaces the old static
 * `redirectTo: 'dashboard'` so opting into Asta OS makes it the landing surface
 * without touching the auth flow.
 */
export const astaModeRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  const mode = inject(AstaModeService);
  return router.createUrlTree([mode.landingRoute()]);
};
