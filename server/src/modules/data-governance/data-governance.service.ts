import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { JobQueueService } from '../queue/job-queue.service';
import { PrivacyService } from '../privacy/privacy.service';
import { FILE_STORAGE_TOKEN, IFileStorage } from '../rag/storage/file-storage';
import { DataJob, DataJobDocument } from './schemas/data-job.schema';

/** Default retention windows (days). Surfaced to admins; enforcement is a future job. */
export const RETENTION_POLICY = {
  aiUsageLogs: 180,
  productEvents: 365,
  notifications: 90,
  errorLogs: 30,
  auditLogs: 730,
  dataExports: 7,
};

@Injectable()
export class DataGovernanceService {
  private readonly log = new Logger(DataGovernanceService.name);

  constructor(
    @InjectModel(DataJob.name)
    private readonly jobs: Model<DataJobDocument>,
    private readonly audit: AuditService,
    private readonly queue: JobQueueService,
    private readonly privacy: PrivacyService,
    @Inject(FILE_STORAGE_TOKEN) private readonly storage: IFileStorage,
  ) {}

  /**
   * Build the owner's export, persist it via file storage, and mark the DataJob ready. Invoked
   * by the queue worker for the `data.export` job (ENABLE_BULLMQ=true). Idempotent and safe to
   * re-run; the on-demand `/privacy/export` endpoint serves the same data when the queue is off.
   */
  async processExport(jobId: string): Promise<{ ok: boolean }> {
    if (!Types.ObjectId.isValid(jobId)) return { ok: false };
    const job = await this.jobs.findById(jobId).exec();
    if (!job || job.kind !== 'export') return { ok: false };
    try {
      const payload =
        job.ownerType === 'user'
          ? await this.privacy.exportData(job.ownerId)
          : {
              exportedAt: new Date().toISOString(),
              ownerType: 'org',
              ownerId: job.ownerId,
            };
      const key = `exports/${jobId}.json`;
      await this.storage.save(
        key,
        Buffer.from(JSON.stringify(payload, null, 2)),
      );
      job.status = 'ready';
      await job.save();
      this.log.debug(`export ${jobId} written to ${this.storage.name}:${key}`);
      return { ok: true };
    } catch (err) {
      job.status = 'failed';
      await job.save();
      this.log.warn(`export ${jobId} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /** Create an export job. Marked ready immediately in dev (no queue); a heavy export
   *  would be processed by a worker and `fileUrl` filled in asynchronously. */
  async requestExport(ownerType: 'user' | 'org', ownerId: string) {
    const expiresAt = new Date(Date.now() + 7 * 86400_000);
    const job = await this.jobs.create({
      ownerType,
      ownerId,
      kind: 'export',
      status: 'ready',
      fileUrl: `/api/${ownerType === 'org' ? 'org/' : ''}privacy/export`,
      expiresAt,
    });
    await this.audit.record({
      actorId: ownerType === 'user' ? ownerId : undefined,
      orgId: ownerType === 'org' ? ownerId : undefined,
      action: 'data.export.requested',
      targetType: ownerType,
      targetId: ownerId,
    });
    // Heavy export runs on the queue when ENABLE_BULLMQ=true; otherwise inline + ledgered.
    await this.queue.enqueue('data.export', {
      ownerType,
      ownerId,
      jobId: String(job._id),
    });
    return this.view(job);
  }

  async requestDeletion(
    ownerType: 'user' | 'org',
    ownerId: string,
    note?: string,
  ) {
    const job = await this.jobs.create({
      ownerType,
      ownerId,
      kind: 'delete_request',
      status: 'pending',
      note,
    });
    await this.audit.record({
      actorId: ownerType === 'user' ? ownerId : undefined,
      orgId: ownerType === 'org' ? ownerId : undefined,
      action: 'data.deletion.requested',
      targetType: ownerType,
      targetId: ownerId,
      metadata: note ? { note } : {},
    });
    return this.view(job);
  }

  async listJobs(ownerType: 'user' | 'org', ownerId: string) {
    const rows = await this.jobs
      .find({ ownerType, ownerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<DataJobDocument[]>()
      .exec();
    return rows.map((j) => this.view(j));
  }

  retention() {
    return RETENTION_POLICY;
  }

  private view(j: DataJobDocument) {
    return {
      id: String(j._id),
      kind: j.kind,
      status: j.status,
      fileUrl: j.fileUrl ?? null,
      expiresAt: j.expiresAt ? new Date(j.expiresAt).toISOString() : null,
      note: j.note ?? null,
      createdAt: (j as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    };
  }
}
