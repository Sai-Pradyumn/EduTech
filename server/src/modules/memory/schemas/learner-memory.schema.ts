import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Kinds of long-term facts Asta can remember about a learner (Phase E). */
export const MEMORY_TYPES = [
  /** Generic learner-stated fact ("remember that …" chat command). */
  'fact',
  'learning_goal',
  'career_goal',
  'time_availability',
  'preferred_modality',
  'weak_area',
  'pace_preference',
  'exam_target',
  'interview_target',
  'project_interest',
  'energy_pattern',
  'language_preference',
  'accessibility_preference',
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = ['saved', 'dismissed'] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export type LearnerMemoryDocument = HydratedDocument<LearnerMemory>;

/** A confirmed (or dismissed) thing Asta remembers — always learner-approved before saving. */
@Schema({ timestamps: true, collection: 'learner_memories' })
export class LearnerMemory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: MEMORY_TYPES, required: true })
  type!: MemoryType;

  /** The remembered value, as confirmed/edited by the learner. */
  @Prop({ required: true })
  value!: string;

  /** Human-readable line Asta showed in the confirmation card. */
  @Prop({ required: true })
  summary!: string;

  @Prop({ type: String, enum: MEMORY_STATUSES, default: 'saved' })
  status!: MemoryStatus;

  /** Where the suggestion originated (e.g. asta_os). */
  @Prop({ default: 'asta_os' })
  source!: string;
}

export const LearnerMemorySchema = SchemaFactory.createForClass(LearnerMemory);
