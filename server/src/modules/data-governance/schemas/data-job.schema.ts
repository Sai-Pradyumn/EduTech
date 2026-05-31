import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DataJobDocument = HydratedDocument<DataJob>;

export type DataJobKind = 'export' | 'delete_request';
export type DataJobStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'failed';

/** Data export / deletion request job (Phase 10 · M14). Tracked so users get a clear
 *  status and admins can audit governance actions. Export payloads are generated on demand
 *  (heavy ones would move to a queue). */
@Schema({ timestamps: true, collection: 'data_jobs' })
export class DataJob {
  @Prop({ required: true, enum: ['user', 'org'], index: true })
  ownerType!: 'user' | 'org';

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ required: true, enum: ['export', 'delete_request'] })
  kind!: DataJobKind;

  @Prop({ default: 'pending' })
  status!: DataJobStatus;

  @Prop()
  fileUrl?: string;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop()
  note?: string;
}

export const DataJobSchema = SchemaFactory.createForClass(DataJob);
DataJobSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
