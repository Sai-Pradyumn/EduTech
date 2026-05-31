import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type JobRunDocument = HydratedDocument<JobRun>;

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed';

/**
 * Background-job ledger (Phase 10 · M7). A lightweight, queue-agnostic record so the Ops
 * Command Center can show waiting/active/failed counts and retry failed jobs even before a
 * real BullMQ worker is wired. Producers call OpsService.recordJob().
 */
@Schema({ timestamps: true, collection: 'job_runs' })
export class JobRun {
  @Prop({ required: true, index: true })
  queue!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: 'waiting', index: true })
  status!: JobStatus;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ default: 3 })
  maxAttempts!: number;

  @Prop({ type: Object, default: {} })
  data!: Record<string, unknown>;

  @Prop()
  error?: string;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  finishedAt?: Date;
}

export const JobRunSchema = SchemaFactory.createForClass(JobRun);
JobRunSchema.index({ status: 1, createdAt: -1 });
