import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const TEMPLATE_TYPES = [
  'flow',
  'roadmap',
  'quiz',
  'simulation',
  'project',
  'study_space',
  'interview',
  'visual',
  'course',
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const TEMPLATE_STATUS = [
  'draft',
  'pending_review',
  'published',
  'rejected',
] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUS)[number];

export type MarketplaceTemplateDocument = HydratedDocument<MarketplaceTemplate>;

/** Phase 9 · Creator/Template Marketplace — a reusable learning asset published by mentors/creators. */
@Schema({ timestamps: true, collection: 'marketplace_templates' })
export class MarketplaceTemplate {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  creator!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organization?: Types.ObjectId;

  @Prop({ type: String, enum: TEMPLATE_TYPES, required: true, index: true })
  type!: TemplateType;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ type: [String], default: [], index: true }) tags!: string[];
  @Prop({ default: 'beginner' }) level!: string;
  @Prop({ default: '' }) targetRole!: string;

  /** The reusable payload (a goal/blueprint the consumer clones into their own asset). */
  @Prop({ type: Object, default: {} }) content!: Record<string, unknown>;

  @Prop({ type: String, enum: ['public', 'org'], default: 'public' })
  visibility!: 'public' | 'org';
  @Prop({ type: String, enum: TEMPLATE_STATUS, default: 'draft', index: true })
  status!: TemplateStatus;

  @Prop({ default: 0 }) usageCount!: number;
  @Prop({
    type: { avg: Number, count: Number },
    default: () => ({ avg: 0, count: 0 }),
  })
  ratingSummary!: { avg: number; count: number };
  @Prop({ default: '' }) reviewNote!: string;
}

export const MarketplaceTemplateSchema =
  SchemaFactory.createForClass(MarketplaceTemplate);
MarketplaceTemplateSchema.index({ status: 1, type: 1, createdAt: -1 });
