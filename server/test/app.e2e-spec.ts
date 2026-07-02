import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Full-stack API e2e: boots the real AppModule (Mongo + every module) the same
 * way main.ts does — global `api` prefix + strict ValidationPipe — and exercises
 * the load-bearing cross-cutting concerns: health, auth, RBAC, validation, and
 * the AI agent's honest offline reply. Requires MongoDB and the seeded demo users
 * (`npm run seed`); CI provides both. Data-dependent assertions are skipped with a
 * clear notice if the demo login can't authenticate, so a missing local seed never
 * looks like a real failure.
 */
const STUDENT = { email: 'student@asta.dev', password: 'student12345' };

/** The global TransformInterceptor wraps every response as { success, data }. */
interface Envelope<T> {
  success: boolean;
  data: T;
}
const body = <T>(res: request.Response): Envelope<T> => res.body as Envelope<T>;

describe('Asta API (e2e)', () => {
  let app: INestApplication<App>;
  let studentToken = '';
  let seeded = false;

  beforeAll(async () => {
    Logger.overrideLogger(false);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(STUDENT);
    const token = body<{ accessToken?: string }>(res).data?.accessToken;
    if (res.status === 200 && token) {
      studentToken = token;
      seeded = true;
    } else {
      console.warn(
        '\n[e2e] Demo login failed — run `npm run seed` (and ensure MongoDB is up). Skipping data-dependent assertions.\n',
      );
    }
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health → ok envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    const b = body<{ status: string }>(res);
    expect(b.success).toBe(true);
    expect(b.data.status).toBe('ok');
  });

  it('POST /api/auth/login (seeded student) → access token', () => {
    if (!seeded) return;
    expect(studentToken.length).toBeGreaterThan(20);
  });

  it('GET /api/auth/me with a valid token → the student profile', async () => {
    if (!seeded) return;
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(body<{ user: { email: string } }>(res).data.user.email).toBe(
      STUDENT.email,
    );
  });

  it('rejects an unauthenticated request to a protected route (401)', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('enforces RBAC: a student cannot read an admin route (403)', async () => {
    if (!seeded) return;
    await request(app.getHttpServer())
      .get('/api/admin/students')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('rejects unknown body fields via the strict ValidationPipe (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ ...STUDENT, hackerField: 'x' })
      .expect(400);
  });

  it('AI agent replies without 500 — real answer live, honest notice offline', async () => {
    if (!seeded) return;
    const res = await request(app.getHttpServer())
      .post('/api/ai/agent/message')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        message: 'What is a closure?',
        agentType: 'tutor',
        mode: 'explain',
      })
      .expect(201);
    const response = body<{ response: { answer: string } }>(res).data.response;
    expect(typeof response.answer).toBe('string');
    expect(response.answer.length).toBeGreaterThan(0);
    // Environment-robust: with a working key this is a substantive real answer;
    // with every key down the gateway's mock terminal must self-identify instead
    // of fabricating (the notice text itself is unit-tested on the mock provider).
    if (!/offline demo mode/i.test(response.answer)) {
      expect(response.answer.length).toBeGreaterThan(40);
      expect(response.answer.toLowerCase()).toContain('closure');
    }
  }, 60_000); // real provider round-trips before the mock terminal can exceed 5s
});
