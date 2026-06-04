import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Why the learner got it wrong (Phase 8 · Mistake OS). */
export const MISTAKE_TYPES = [
  'misconception',
  'missing_prerequisite',
  'careless_error',
  'weak_recall',
  'poor_explanation',
  'implementation_gap',
  'interview_communication_gap',
  'project_architecture_gap',
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

export const MISTAKE_SOURCES = [
  'quiz',
  'tutor',
  'voice',
  'project',
  'rag',
  'roadmap',
  'manual',
] as const;
export type MistakeSource = (typeof MISTAKE_SOURCES)[number];

export const MISTAKE_STATUSES = ['open', 'repairing', 'resolved'] as const;
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number];

export const REPAIR_ACTION_KINDS = [
  'micro_quiz',
  'visual_correction',
  'tutor_explanation',
  'voice_viva',
  'flow_repair_node',
] as const;
export type RepairActionKind = (typeof REPAIR_ACTION_KINDS)[number];

@Schema({ _id: false })
export class RepairAction {
  @Prop({ required: true }) id!: string;
  @Prop({ type: String, enum: REPAIR_ACTION_KINDS }) kind!: RepairActionKind;
  @Prop({ required: true }) label!: string;
  @Prop() route?: string;
  @Prop() prompt?: string;
  @Prop({ default: false }) done!: boolean;
}
const RepairActionSchema = SchemaFactory.createForClass(RepairAction);

export type MistakeDocument = HydratedDocument<Mistake>;

@Schema({ timestamps: true, collection: 'mistakes' })
export class Mistake {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  org?: Types.ObjectId;

  /** The concept the learner is struggling with. */
  @Prop({ required: true }) concept!: string;
  @Prop({ default: '' }) topic!: string;

  @Prop({ type: String, enum: MISTAKE_TYPES, default: 'weak_recall' })
  mistakeType!: MistakeType;

  @Prop({ default: '' }) wrongReasoning!: string;
  @Prop({ default: '' }) correction!: string;

  /** 0–100 (higher = worse). */
  @Prop({ default: 50, min: 0, max: 100 }) severity!: number;
  /** How many times this has been observed. */
  @Prop({ default: 1 }) frequency!: number;

  @Prop({ type: String, enum: MISTAKE_SOURCES, default: 'quiz' })
  source!: MistakeSource;
  @Prop() sourceId?: string;

  @Prop({ type: String, enum: MISTAKE_STATUSES, default: 'open' })
  status!: MistakeStatus;

  @Prop({ type: [RepairActionSchema], default: [] })
  repairActions!: RepairAction[];

  @Prop() linkedQuizId?: string;
  @Prop() linkedFlowId?: string;
  @Prop() linkedVisualId?: string;

  @Prop() lastSeenAt?: Date;
  @Prop() resolvedAt?: Date;

  // ── Spaced review (SM-2-lite) — resurfaces weak concepts on a schedule ──
  /** When this concept is next due for a review prompt. */
  @Prop() nextReviewAt?: Date;
  /** Current spacing interval in days. */
  @Prop({ default: 1 }) reviewInterval!: number;
  /** Ease factor (1.3–3.0); recall raises it, a lapse lowers it. */
  @Prop({ default: 2.3, min: 1.3, max: 3 }) reviewEase!: number;
  /** How many spaced reviews have happened. */
  @Prop({ default: 0 }) reviewCount!: number;
  @Prop() lastReviewedAt?: Date;
}

export const MistakeSchema = SchemaFactory.createForClass(Mistake);
MistakeSchema.index({ user: 1, status: 1, severity: -1 });
// Pull "due for review" cheaply (status filtered in the query).
MistakeSchema.index({ user: 1, nextReviewAt: 1 });
// One live entry per concept per user (capture upserts/increments instead of duplicating).
MistakeSchema.index({ user: 1, concept: 1 }, { unique: false });
