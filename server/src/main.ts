import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { securityHeaders } from './common/middleware/security.middleware';
import { rateLimit } from './common/middleware/rate-limit.middleware';
import { requestId } from './common/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  // rawBody: true buffers the raw request body so payment webhooks can HMAC-verify it.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  const config = app.get(ConfigService<AppConfig, true>);

  // Request correlation (M7): stable requestId + X-Request-Id on every request.
  app.use(requestId);
  // Security hardening (B12): headers + per-IP rate limiting.
  app.use(securityHeaders);
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));
  // Brute-force hardening: a much tighter per-IP budget on the credential/OTP
  // endpoints (the global 300/min is far too generous for guessing a 6-digit code
  // or a password). Frequently-polled routes (auth/me, auth/refresh) keep the
  // global limit. This limiter owns its own bucket map, so it counts independently.
  app.use(
    [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/verify-otp',
      '/api/auth/resend-otp',
      '/api/auth/google',
    ],
    rateLimit({ windowMs: 60_000, max: 20 }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('clientOrigin', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const port = config.get('port', { infer: true });
  await app.listen(port);
  Logger.log(`Asta API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
