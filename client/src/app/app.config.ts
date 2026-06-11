import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  provideZoneChangeDetection,
} from '@angular/core';
import { GlobalErrorHandler } from './core/error/global-error-handler';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';
import { WebVitalsService } from './core/services/web-vitals.service';

/** Restore the session from a stored token before the app renders. */
function sessionInitializer(auth: AuthService): () => Promise<void> {
  return async () => {
    if (!auth.accessToken) return;
    try {
      await firstValueFrom(auth.loadCurrentUser());
    } catch {
      auth.clearSession();
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withInterceptors([authTokenInterceptor, errorInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthService],
      useFactory: sessionInitializer,
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [WebVitalsService],
      useFactory: (vitals: WebVitalsService) => () => vitals.start(),
    },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
