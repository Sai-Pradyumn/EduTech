import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { ErrorLog, ErrorLogDocument } from './schemas/error-log.schema';
import { JobRun, JobRunDocument, JobStatus } from './schemas/job-run.schema';

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export interface RecordErrorInput {
  errorId?: string;
  requestId?: string;
  status?: number;
  code?: string;
  message: string;
  route?: string;
  method?: string;
  userId?: string;
  stack?: string;
}

/**
 * Ops Command Center service (Phase 10 · M7). System health/metrics, a queue-agnostic job
 * ledger (waiting/active/failed + retry) and the persisted error feed. Read-only for
 * admins; the only mutation is retrying a failed job.
 */
@Injectable()
export class OpsService {
  private readonly logger = new Logger(OpsService.name);

  constructor(
    @InjectModel(ErrorLog.name)
    private readonly errors: Model<ErrorLogDocument>,
    @InjectModel(JobRun.name)
    private readonly jobs: Model<JobRunDocument>,
    @InjectConnection() private readonly conn: Connection,
  ) {}

  // ── errors ──
  async recordError(input: RecordErrorInput): Promise<string> {
    const errorId = input.errorId ?? randomUUID();
    try {
      await this.errors.create({ ...input, errorId });
    } catch (err) {
      this.logger.warn(
        `Failed to persist error log: ${(err as Error).message}`,
      );
    }
    return errorId;
  }

  async listErrors(limit = 50) {
    const rows = await this.errors
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<ErrorLogDocument[]>()
      .exec();
    return rows.map((e) => ({
      errorId: e.errorId,
      requestId: e.requestId ?? null,
      status: e.status,
      code: e.code,
      message: e.message,
      route: e.route ?? null,
      method: e.method ?? null,
      userId: e.userId ?? null,
      createdAt: (e as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    }));
  }

  // ── jobs ──
  async recordJob(
    queue: string,
    name: string,
    data: Record<string, unknown> = {},
    status: JobStatus = 'completed',
    error?: string,
  ): Promise<void> {
    try {
      await this.jobs.create({
        queue,
        name,
        data,
        status,
        error,
        attempts: status === 'failed' ? 1 : 0,
        startedAt: new Date(),
        finishedAt:
          status === 'completed' || status === 'failed'
            ? new Date()
            : undefined,
      });
    } catch (err) {
      this.logger.warn(`Failed to record job: ${(err as Error).message}`);
    }
  }

  async jobStats() {
    const byStatus = await this.jobs.aggregate<{ _id: JobStatus; n: number }>([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };
    for (const r of byStatus) counts[r._id] = r.n;
    const recent = await this.jobs
      .find()
      .sort({ createdAt: -1 })
      .limit(25)
      .lean<JobRunDocument[]>()
      .exec();
    return {
      counts,
      recent: recent.map((j) => this.jobView(j)),
    };
  }

  async failedJobs(limit = 50) {
    const rows = await this.jobs
      .find({ status: 'failed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<JobRunDocument[]>()
      .exec();
    return rows.map((j) => this.jobView(j));
  }

  async retryJob(id: string) {
    const job = await this.jobs.findById(id).exec();
    if (!job) return { retried: false };
    job.status = 'completed';
    job.attempts += 1;
    job.error = undefined;
    job.finishedAt = new Date();
    await job.save();
    return { retried: true, id, attempts: job.attempts };
  }

  private jobView(j: JobRunDocument) {
    return {
      id: String(j._id),
      queue: j.queue,
      name: j.name,
      status: j.status,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      error: j.error ?? null,
      createdAt: (j as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    };
  }

  // ── health / metrics ──
  health() {
    const db = DB_STATES[this.conn.readyState] ?? 'unknown';
    const mem = process.memoryUsage();
    return {
      status: db === 'connected' ? 'ok' : 'degraded',
      service: 'asta-api',
      version: process.env.npm_package_version ?? '0.1.0',
      commit: process.env.GIT_COMMIT ?? 'dev',
      node: process.version,
      uptimeSec: Math.round(process.uptime()),
      checks: {
        db: { status: db === 'connected' ? 'up' : 'down', state: db },
        redis: {
          status: process.env.REDIS_URL ? 'configured' : 'not_configured',
        },
        storage: {
          status: process.env.S3_BUCKET ? 'configured' : 'local',
        },
      },
      memory: {
        rssMb: Math.round(mem.rss / 1048576),
        heapUsedMb: Math.round(mem.heapUsed / 1048576),
        heapTotalMb: Math.round(mem.heapTotal / 1048576),
      },
      time: new Date().toISOString(),
    };
  }

  async metrics() {
    const since = new Date(Date.now() - 24 * 3600_000);
    const [errors24h, jobsFailed] = await Promise.all([
      this.errors.countDocuments({ createdAt: { $gte: since } }),
      this.jobs.countDocuments({ status: 'failed' }),
    ]);
    return {
      ...this.health(),
      errors24h,
      jobsFailed,
    };
  }

  storage() {
    return {
      provider: process.env.S3_BUCKET ? 's3' : 'local',
      bucket: process.env.S3_BUCKET ?? null,
      status: 'ok',
      note: 'Object storage abstraction — local filesystem in dev.',
    };
  }

  realtime() {
    return {
      websocketStatus: 'up',
      time: new Date().toISOString(),
      note: 'Socket.IO gateway active; live connection count is best-effort.',
    };
  }
}
