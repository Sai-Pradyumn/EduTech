import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentChunkDocument = HydratedDocument<DocumentChunk>;

/**
 * A retrievable unit of a document: its text, embedding vector and provenance
 * (heading path / page / timestamp) used to build human-readable citations.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'document_chunks' })
export class DocumentChunk {
  @Prop({ type: Types.ObjectId, ref: 'KnowledgeDocument', required: true, index: true })
  document!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  documentTitle!: string;

  @Prop({ required: true })
  chunkIndex!: number;

  @Prop({ required: true })
  text!: string;

  /** Dense vector from IAIProvider.generateEmbedding (L2-normalized). */
  @Prop({ type: [Number], default: [] })
  embedding!: number[];

  @Prop()
  headingPath?: string;

  @Prop()
  section?: string;

  @Prop()
  pageStart?: number;

  @Prop()
  pageEnd?: number;

  /** YouTube transcript timestamps (seconds). */
  @Prop()
  tStart?: number;

  @Prop()
  tEnd?: number;

  @Prop({ default: 0 })
  charStart!: number;

  @Prop({ default: 0 })
  charEnd!: number;

  @Prop({ default: 0 })
  tokenCount!: number;

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ default: 'en' })
  language!: string;
}

export const DocumentChunkSchema = SchemaFactory.createForClass(DocumentChunk);
DocumentChunkSchema.index({ document: 1, chunkIndex: 1 });
// Text index powers the sparse/keyword path of hybrid retrieval on the non-Atlas backend.
DocumentChunkSchema.index({ text: 'text' });
