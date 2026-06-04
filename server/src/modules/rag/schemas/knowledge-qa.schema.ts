import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type KnowledgeQaDocument = HydratedDocument<KnowledgeQa>;

/** A persisted grounded-Q&A turn from the Knowledge Hub (so the transcript syncs across devices). */
@Schema({ timestamps: true, collection: 'knowledge_qa' })
export class KnowledgeQa {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) question!: string;
  @Prop({ default: '' }) answer!: string;
  /** Citations as returned to the client (stored verbatim for faithful restore). */
  @Prop({ type: [Object], default: [] }) sources!: Record<string, unknown>[];
  @Prop({ default: 0 }) confidence!: number;
}

export const KnowledgeQaSchema = SchemaFactory.createForClass(KnowledgeQa);
KnowledgeQaSchema.index({ user: 1, createdAt: -1 });
