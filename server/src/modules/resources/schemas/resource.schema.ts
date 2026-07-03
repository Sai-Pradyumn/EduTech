import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Learning-resource kinds a general edu user expects to browse. */
export const RESOURCE_KINDS = [
  'course',
  'docs',
  'video',
  'practice',
  'book',
  'article',
  'tool',
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
] as const;
export type ResourceLevel = (typeof RESOURCE_LEVELS)[number];

export type ResourceDocument = HydratedDocument<Resource>;

/**
 * One curated external learning resource. The catalog ships with the app
 * (idempotently seeded) and is admin-extendable — real links with honest
 * metadata, matched to each learner's goal/skills/weak areas at read time.
 */
@Schema({ timestamps: true, collection: 'resources' })
export class Resource {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) url!: string;
  /** Publisher/platform, e.g. "MDN", "freeCodeCamp". */
  @Prop({ required: true }) provider!: string;
  @Prop({ type: String, enum: RESOURCE_KINDS, default: 'article' })
  kind!: ResourceKind;
  @Prop({ type: [String], default: [], index: true }) topics!: string[];
  @Prop({ type: String, enum: RESOURCE_LEVELS, default: 'beginner' })
  level!: ResourceLevel;
  /** Honest time estimate to complete/consume, in minutes (0 = reference). */
  @Prop({ default: 0 }) minutes!: number;
  @Prop({ default: true }) free!: boolean;
  @Prop({ default: '' }) description!: string;
  /** Curator quality score 0–100 (ranks ties). */
  @Prop({ default: 70, min: 0, max: 100 }) quality!: number;

  /** Community submissions land as 'pending' until an admin approves them. */
  @Prop({
    type: String,
    enum: ['approved', 'pending'],
    default: 'approved',
    index: true,
  })
  status!: 'approved' | 'pending';

  @Prop({ type: Types.ObjectId, ref: 'User' })
  submittedBy?: Types.ObjectId;

  /** Learner upvotes — social proof shown on every card. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  upvotes!: Types.ObjectId[];
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);
ResourceSchema.index({ title: 'text', description: 'text', provider: 'text' });

export const PROGRESS_STATUSES = ['saved', 'in_progress', 'done'] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export type ResourceProgressDocument = HydratedDocument<ResourceProgress>;

/** A learner's relationship with one resource (their library). */
@Schema({ timestamps: true, collection: 'resource_progress' })
export class ResourceProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: Resource.name, required: true })
  resource!: Types.ObjectId;
  @Prop({ type: String, enum: PROGRESS_STATUSES, default: 'saved' })
  status!: ProgressStatus;
}

export const ResourceProgressSchema =
  SchemaFactory.createForClass(ResourceProgress);
ResourceProgressSchema.index({ user: 1, resource: 1 }, { unique: true });
