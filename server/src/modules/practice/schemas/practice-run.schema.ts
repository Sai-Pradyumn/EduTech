import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../practice.types';

export const RUN_KINDS = ['run', 'submit', 'free', 'terminal'] as const;
export type RunKind = (typeof RUN_KINDS)[number];

export type PracticeRunDocument = HydratedDocument<PracticeRun>;

/**
 * A lightweight record of one execution so the studio can show a "recent runs"
 * history (it kept nothing before). Stores a short code preview, not the full
 * program, to stay cheap; capped per user by the service.
 */
@Schema({ timestamps: true, collection: 'practice_runs' })
export class PracticeRun {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: SUPPORTED_LANGUAGES, required: true })
  language!: SupportedLanguage;

  @Prop({ type: String, enum: RUN_KINDS, default: 'run' })
  kind!: RunKind;

  /** Problem / snippet label, when one applies. */
  @Prop() title?: string;

  @Prop({ default: false }) ok!: boolean;
  @Prop({ default: false }) simulated!: boolean;
  @Prop({ default: 0 }) durationMs!: number;

  /** For graded submits. */
  @Prop() passed?: number;
  @Prop() total?: number;

  /** First lines of the program, for context in the history list. */
  @Prop({ default: '' }) codePreview!: string;
}

export const PracticeRunSchema = SchemaFactory.createForClass(PracticeRun);
PracticeRunSchema.index({ user: 1, createdAt: -1 });
