import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type FineTuningJobDocument = HydratedDocument<FineTuningJob>;

/**
 * Fine-tuning job (Phase 3 · A8): a LoRA/PEFT run record orchestrating the `ml-service`.
 * The ml-service is GPU-ready but NOT wired into the app, so progression is simulated
 * (derived from elapsed time on read). Gated by ENABLE_FINE_TUNING.
 */
@Schema({ timestamps: true, collection: 'fine_tuning_jobs' })
export class FineTuningJob {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: 'mistral-7b' })
  baseModel!: string;

  @Prop({ default: 'asta-tutor-traces' })
  datasetName!: string;

  @Prop({ default: 500 })
  datasetSize!: number;

  @Prop({ default: 3 })
  epochs!: number;

  @Prop({
    type: String,
    enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
    default: 'running',
    index: true,
  })
  status!: JobStatus;

  @Prop({ default: 0, min: 0, max: 100 })
  progress!: number;

  @Prop({ type: Object, default: {} })
  metrics!: { finalLoss?: number; evalAccuracy?: number };

  @Prop()
  errorMessage?: string;

  /** When the simulated run began (drives progress derivation). */
  @Prop({ type: Date, default: () => new Date() })
  startedAt!: Date;

  @Prop({ type: Date })
  finishedAt?: Date;
}

export const FineTuningJobSchema = SchemaFactory.createForClass(FineTuningJob);
FineTuningJobSchema.index({ createdBy: 1, createdAt: -1 });
