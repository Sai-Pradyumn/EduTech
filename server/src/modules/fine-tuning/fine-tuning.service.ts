import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FineTuningJob,
  FineTuningJobDocument,
  JobStatus,
} from './schemas/fine-tuning-job.schema';

export interface CreateJobInput {
  name: string;
  baseModel?: string;
  datasetName?: string;
  datasetSize?: number;
  epochs?: number;
}

export interface JobView {
  id: string;
  name: string;
  baseModel: string;
  datasetName: string;
  datasetSize: number;
  epochs: number;
  status: JobStatus;
  progress: number;
  metrics: { finalLoss?: number; evalAccuracy?: number };
  errorMessage?: string;
  createdAt: string;
}

/** Simulated run duration — a LoRA job "completes" this many seconds after it starts. */
const RUN_DURATION_SEC = 45;

/**
 * Fine-Tuning Lab (Phase 3 · A8): job records orchestrating the `ml-service` LoRA trainer.
 * Since the ml-service is not wired into the app, progress is **derived from elapsed time on
 * read** and lazily persisted on completion (mock metrics). Gated by ENABLE_FINE_TUNING.
 */
@Injectable()
export class FineTuningService {
  constructor(
    @InjectModel(FineTuningJob.name)
    private readonly jobs: Model<FineTuningJobDocument>,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return this.config.get<boolean>('flags.fineTuning') ?? false;
  }

  status(): { enabled: boolean } {
    return { enabled: this.enabled };
  }

  async create(userId: string, input: CreateJobInput): Promise<JobView> {
    this.assertEnabled();
    const job = await this.jobs.create({
      createdBy: new Types.ObjectId(userId),
      name: input.name,
      baseModel: input.baseModel ?? 'mistral-7b',
      datasetName: input.datasetName ?? 'asta-tutor-traces',
      datasetSize: input.datasetSize ?? 500,
      epochs: input.epochs ?? 3,
      status: 'running',
      progress: 0,
      startedAt: new Date(),
    });
    return this.view(job);
  }

  async list(userId: string): Promise<JobView[]> {
    const jobs = await this.jobs
      .find({ createdBy: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return Promise.all(jobs.map((j) => this.tick(j).then((d) => this.view(d))));
  }

  async get(userId: string, id: string): Promise<JobView> {
    return this.view(await this.tick(await this.owned(userId, id)));
  }

  async cancel(userId: string, id: string): Promise<JobView> {
    const job = await this.owned(userId, id);
    if (job.status === 'running' || job.status === 'queued') {
      job.status = 'cancelled';
      job.finishedAt = new Date();
      await job.save();
    }
    return this.view(job);
  }

  // ── simulation ──────────────────────────────────────────────────────────────
  /** Advance a running job's progress based on wall-clock elapsed since it started. */
  private async tick(
    job: FineTuningJobDocument,
  ): Promise<FineTuningJobDocument> {
    if (job.status !== 'running') return job;
    const elapsedSec = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
    const progress = Math.min(
      100,
      Math.round((elapsedSec / RUN_DURATION_SEC) * 100),
    );
    if (progress >= 100) {
      job.progress = 100;
      job.status = 'succeeded';
      job.finishedAt = new Date();
      // Deterministic mock metrics that improve with epochs / dataset size.
      const evalAccuracy = Math.min(
        0.98,
        0.7 + job.epochs * 0.05 + job.datasetSize / 10000,
      );
      job.metrics = {
        finalLoss:
          Math.round((0.9 - Math.min(0.5, job.epochs * 0.12)) * 1000) / 1000,
        evalAccuracy: Math.round(evalAccuracy * 1000) / 1000,
      };
      await job.save();
    } else if (progress !== job.progress) {
      job.progress = progress;
      await job.save();
    }
    return job;
  }

  private assertEnabled(): void {
    if (!this.enabled)
      throw new ForbiddenException(
        'Fine-Tuning Lab is disabled. Set ENABLE_FINE_TUNING=true to enable it.',
      );
  }

  private async owned(
    userId: string,
    id: string,
  ): Promise<FineTuningJobDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Job not found');
    const job = await this.jobs.findOne({
      _id: id,
      createdBy: new Types.ObjectId(userId),
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private view(j: FineTuningJobDocument): JobView {
    return {
      id: String(j._id),
      name: j.name,
      baseModel: j.baseModel,
      datasetName: j.datasetName,
      datasetSize: j.datasetSize,
      epochs: j.epochs,
      status: j.status,
      progress: j.progress,
      metrics: j.metrics ?? {},
      errorMessage: j.errorMessage,
      createdAt:
        (
          j as FineTuningJobDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }
}
