import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Lifecycle of an uploaded document through the ingestion pipeline. */
export type IngestStatus =
  | 'pending'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'ready'
  | 'failed';
export type DocSource = 'upload' | 'text' | 'youtube';

export type KnowledgeDocumentDocument = HydratedDocument<KnowledgeDocument>;

@Schema({ timestamps: true, collection: 'knowledge_documents' })
export class KnowledgeDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({
    type: String,
    enum: ['upload', 'text', 'youtube'],
    default: 'upload',
  })
  source!: DocSource;

  /** Storage key for the original file (LocalFileStorage / S3). Empty for pasted text. */
  @Prop({ default: '' })
  fileKey!: string;

  @Prop({ default: 'text/plain' })
  mimeType!: string;

  /** SHA-256 of normalized content — idempotency key for re-uploads/retries. */
  @Prop({ index: true })
  contentHash?: string;

  @Prop({
    type: String,
    enum: ['pending', 'parsing', 'chunking', 'embedding', 'ready', 'failed'],
    default: 'pending',
    index: true,
  })
  status!: IngestStatus;

  @Prop({ default: 0 })
  pageCount!: number;

  @Prop({ default: 0 })
  chunkCount!: number;

  @Prop({ default: 0 })
  tokenCount!: number;

  @Prop({ default: 'mock' })
  embeddingProvider!: string;

  @Prop({ default: 0 })
  embeddingDimension!: number;

  @Prop()
  topic?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ default: 'en' })
  language!: string;

  @Prop({ type: [String], default: [] })
  warnings!: string[];

  @Prop()
  error?: string;
}

export const KnowledgeDocumentSchema =
  SchemaFactory.createForClass(KnowledgeDocument);
KnowledgeDocumentSchema.index({ user: 1, status: 1 });
KnowledgeDocumentSchema.index({ tags: 1 });
