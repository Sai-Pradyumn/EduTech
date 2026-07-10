import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { securityHeaders } from './common/middleware/security.middleware';
import {
  rateLimit,
  RateLimitStore,
  RedisRateLimitStore,
} from './common/middleware/rate-limit.middleware';
import {
  concurrencyLimit,
  hpp,
  methodFilter,
  mongoSanitize,
  originCheck,
} from './common/middleware/harden.middleware';
import { requestId } from './common/middleware/request-id.middleware';
import { checkProductionSecrets } from './common/security/boot-checks';

/**
 * Cluster-wide rate limiting (API-02): with RATE_LIMIT_REDIS=true the limiters share one
 * Redis-backed counter store, so per-IP budgets hold across horizontally-scaled instances.
 * Default stays in-memory (single instance / dev). The store fails open to memory if
 * Redis is unreachable.
 */
function buildRateLimitStore(
  config: ConfigService<AppConfig, true>,
): RateLimitStore | undefined {
  if (process.env.RATE_LIMIT_REDIS !== 'true') return undefined;
  // Lazy require so environments without Redis never load the client.

  const { default: Redis } = require('ioredis') as typeof import('ioredis');
  const client = new Redis({
    host: config.get('redis.host', { infer: true }),
    port: config.get('redis.port', { infer: true }),
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  client.on('error', () => undefined); // store logs once; don't crash on connection noise
  return new RedisRateLimitStore(client, 'rl:', (msg) =>
    new Logger('RateLimit').warn(msg),
  );
}

async function bootstrap(): Promise<void> {
  // rawBody: true buffers the raw request body so payment webhooks can HMAC-verify it.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  const config = app.get(ConfigService<AppConfig, true>);

  // Secure-boot gate (§12): refuse to start production with dev/weak/identical JWT
  // secrets — a process that won't boot beats one that mints forgeable tokens.
  const bootCheck = checkProductionSecrets({
    nodeEnv: config.get('nodeEnv', { infer: true }),
    jwtSecret: config.get('jwt.secret', { infer: true }),
    jwtRefreshSecret: config.get('jwt.refreshSecret', { infer: true }),
  });
  if (!bootCheck.ok) {
    for (const p of bootCheck.problems) Logger.error(`Boot check: ${p}`);
    process.exit(1);
  }

  // Slowloris/stuck-client defense: bound how long headers and whole requests may take.
  const httpServer = app.getHttpServer() as import('http').Server;
  httpServer.headersTimeout = 15_000;
  httpServer.requestTimeout = 120_000;
  httpServer.keepAliveTimeout = 5_000;

  // Request correlation (M7): stable requestId + X-Request-Id on every request.
  app.use(requestId);
  // Security hardening (B12): headers + request-shape hardening + per-IP rate limiting.
  app.use(securityHeaders);
  app.use(methodFilter); // reject TRACE/TRACK (XST)
  app.use(
    // CSRF backstop: cross-site browser writes are rejected; server-to-server unaffected.
    originCheck({
      allowedOrigins: [config.get('clientOrigin', { infer: true })],
      enabled: config.get('security.strictOriginCheck', { infer: true }),
    }),
  );
  app.use(hpp); // collapse duplicated query params (parameter pollution)
  app.use(mongoSanitize); // strip $operators / proto-pollution keys from body & query
  app.use(
    // Load shedding (0 = disabled): shed with 503 instead of drowning the event loop.
    concurrencyLimit(config.get('security.maxInflight', { infer: true })),
  );
  // One shared store (when Redis-backed) — keys are scoped per budget inside the limiter.
  const store = buildRateLimitStore(config);
  app.use(rateLimit({ windowMs: 60_000, max: 300, store }));
  // Brute-force hardening: a much tighter per-IP budget on the credential/OTP
  // endpoints (the global 300/min is far too generous for guessing a 6-digit code
  // or a password). Frequently-polled routes (auth/me, auth/refresh) keep the
  // global limit. This limiter counts independently of the global one.
  app.use(
    [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/verify-otp',
      '/api/auth/resend-otp',
      '/api/auth/google',
      // Second-factor verification is a code-guessing target too — keep it on the tight budget.
      '/api/auth/mfa/verify-login',
    ],
    rateLimit({ windowMs: 60_000, max: 20, store }),
  );
  // Client-error ingestion is public (errors happen on public pages too) — give it
  // its own tiny per-IP budget so it can't be used to flood the error collection.
  app.use(
    '/api/ops/client-errors',
    rateLimit({ windowMs: 60_000, max: 10, store }),
  );
  // Uploads are the most expensive request type (buffered file + parsing + ingestion) —
  // cap them well below the global budget (§18 upload rate limits).
  app.use(
    '/api/knowledge/upload',
    rateLimit({ windowMs: 60_000, max: 10, store }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('clientOrigin', { infer: true }),
    credentials: true,
    // Explicit verb allowlist (no TRACE/CONNECT surprises) + cached preflights.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    maxAge: 600,
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
  // A clear, actionable message beats an unhandled-rejection stack when the port
  // is already taken — by far the most common reason "the backend won't start"
  // on a dev box (a previous run still holding :3000).
  try {
    await app.listen(port);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EADDRINUSE') {
      Logger.error(
        `Port ${port} is already in use — another process (likely a previous Asta API run) is holding it. ` +
          `Stop it and retry, or start on another port with PORT=3001 npm run dev.`,
        'Bootstrap',
      );
    } else {
      Logger.error(
        `Failed to start Asta API: ${e.message}`,
        e.stack,
        'Bootstrap',
      );
    }
    await app.close().catch(() => undefined);
    process.exit(1);
  }
  Logger.log(`Asta API listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // Anything thrown during module init (bad config, unreachable required service)
  // lands here with a readable message instead of a bare UnhandledPromiseRejection.
  const e = err as Error;
  Logger.error(
    `Asta API failed to bootstrap: ${e.message}`,
    e.stack,
    'Bootstrap',
  );
  process.exit(1);
});
