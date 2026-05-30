import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Students who haven't completed onboarding are sent to /onboarding before /app. */
export const onboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();
  if (user && user.role === 'student' && !user.isOnboarded) {
    return router.createUrlTree(['/onboarding']);
  }
  return true;
};
