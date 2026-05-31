import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntegrationConnectionDocument =
  HydratedDocument<IntegrationConnection>;
export type IntegrationSyncLogDocument = HydratedDocument<IntegrationSyncLog>;

/** A user/org connection to an external provider (Phase 10 · M12). Credentials are never
 *  stored inline — only an opaque reference; mock connections need none. */
@Schema({ timestamps: true, collection: 'integration_connections' })
export class IntegrationConnection {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  org?: Types.ObjectId;

  @Prop({ required: true, index: true })
  provider!: string;

  @Prop({ default: 'connected', enum: ['connected', 'disconnected', 'error'] })
  status!: string;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop()
  encryptedCredentialsRef?: string;

  @Prop({ type: Date })
  lastSyncAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export const IntegrationConnectionSchema = SchemaFactory.createForClass(
  IntegrationConnection,
);

@Schema({ timestamps: true, collection: 'integration_sync_logs' })
export class IntegrationSyncLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'IntegrationConnection',
    required: true,
    index: true,
  })
  connection!: Types.ObjectId;

  @Prop({ default: 'success' })
  status!: string;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ default: 0 })
  recordsProcessed!: number;

  @Prop()
  error?: string;
}

export const IntegrationSyncLogSchema =
  SchemaFactory.createForClass(IntegrationSyncLog);
