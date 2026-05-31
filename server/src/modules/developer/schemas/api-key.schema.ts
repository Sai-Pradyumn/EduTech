import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

/** Org-scoped developer API key (Phase 10 · M11). Only the SHA-256 hash is stored; the
 *  plaintext is shown exactly once at creation. `prefix` lets the UI display a safe stub. */
@Schema({ timestamps: true, collection: 'api_keys' })
export class ApiKey {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  org!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  keyHash!: string;

  @Prop({ required: true })
  prefix!: string;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: Date })
  revokedAt?: Date;

  @Prop()
  createdBy?: string;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
