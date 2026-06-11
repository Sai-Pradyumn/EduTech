import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  // Client-error ingestion is public (errors happen on public pages too) — give it
  // its own tiny per-IP budget so it can't be used to flood the error collection.
  app.use('/api/ops/client-errors', rateLimit({ windowMs: 60_000, max: 10 }));

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

  // API docs (backlog §11): generated from the Nest controllers at /api/docs.
  // Non-production only by default; set ENABLE_API_DOCS=true to expose in prod.
  const nodeEnv = config.get('nodeEnv', { infer: true });
  if (nodeEnv !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
    const docConfig = new DocumentBuilder()
      .setTitle('Asta API')
      .setDescription('Asta — AI Skill Mentor REST API')
      .setVersion(process.env.npm_package_version ?? '0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, () =>
      SwaggerModule.createDocument(app, docConfig),
    );
  }

  const port = config.get('port', { infer: true });
  await app.listen(port);
  Logger.log(`Asta API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
