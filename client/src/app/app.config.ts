import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { GlobalErrorHandler } from './core/error/global-error-handler';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  TitleStrategy,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { refreshInterceptor } from './core/interceptors/refresh.interceptor';
import { AuthService } from './core/services/auth.service';
import { WebVitalsService } from './core/services/web-vitals.service';
import { AstaTitleStrategy } from './core/title-strategy';
import { provideActiveLocale } from './core/i18n/locale-providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Date/number/currency pipes format in the learner's saved locale (₹/$, dd-MM, grouping).
    ...provideActiveLocale(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    // Order matters: refreshInterceptor is last so its 401 handler runs FIRST on the
    // response path — it refreshes + retries before errorInterceptor's logout fires.
    provideHttpClient(
      withInterceptors([authTokenInterceptor, errorInterceptor, refreshInterceptor]),
    ),
    // Restore the session from a stored token before the app renders. Only a
    // confirmed-invalid token clears the session. A 401 here means the refresh
    // interceptor already tried and failed to refresh, so the credentials are
    // truly dead → log out. A 403 means the token is VALID but forbidden (a
    // permission/middleware edge, not expired creds) and a transient failure
    // (rate limit, flaky network, server restart) is recoverable — neither must
    // log the user out while their refresh token is still good.
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      if (!auth.accessToken) return;
      try {
        await firstValueFrom(auth.loadCurrentUser());
      } catch (err) {
        const status = (err as { status?: number })?.status ?? 0;
        if (status === 401) auth.clearSession();
        else if (status === 403)
          console.warn(
            'Bootstrap /auth/me was forbidden (403) — keeping the session; credentials are still valid.',
          );
      }
    }),
    // Start web-vitals reporting once the app boots.
    provideAppInitializer(() => inject(WebVitalsService).start()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Brand every browser-tab title ("<page> · Asta") instead of bare route titles.
    { provide: TitleStrategy, useClass: AstaTitleStrategy },
  ],
};
