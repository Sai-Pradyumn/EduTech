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
import { AuthService } from './core/services/auth.service';
import { WebVitalsService } from './core/services/web-vitals.service';
import { AstaTitleStrategy } from './core/title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withInterceptors([authTokenInterceptor, errorInterceptor])),
    // Restore the session from a stored token before the app renders.
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      if (!auth.accessToken) return;
      try {
        await firstValueFrom(auth.loadCurrentUser());
      } catch {
        auth.clearSession();
      }
    }),
    // Start web-vitals reporting once the app boots.
    provideAppInitializer(() => inject(WebVitalsService).start()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Brand every browser-tab title ("<page> · Asta") instead of bare route titles.
    { provide: TitleStrategy, useClass: AstaTitleStrategy },
  ],
};
