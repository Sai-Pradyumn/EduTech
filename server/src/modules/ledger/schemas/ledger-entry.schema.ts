import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Verified learning-event kinds. The first block is the Phase 8 set (kept stable for old data);
 * the second block is the Phase 9 · Outcome Network additions (reviews, interviews, mentor, etc.).
 */
export const LEDGER_KINDS = [
  // ── Phase 8 ──
  'node_completed',
  'quiz_passed',
  'mistake_resolved',
  'simulation_finished',
  'project_submitted',
  'week_completed',
  'flow_generated',
  'certificate_earned',
  // ── Phase 9 ──
  'quiz_failed',
  'project_ai_reviewed',
  'project_mentor_approved',
  'voice_viva_passed',
  'mentor_feedback_added',
  'skill_mastery_increased',
  'daily_plan_completed',
  'interview_completed',
  'interview_passed',
  'evidence_added',
  // ── Practice Studio ──
  'practice_solved',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/** How strongly a proof event is verified — drives the trust badge in the Skill Passport. */
export const VERIFICATION_LEVELS = [
  'self',
  'ai',
  'system',
  'mentor',
  'certificate',
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;

@Schema({ timestamps: true, collection: 'ledger_entries' })
export class LedgerEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: LEDGER_KINDS, required: true })
  kind!: LedgerKind;

  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) detail!: string;
  /** 0–100 score where relevant (quiz, simulation, review). */
  @Prop() score?: number;
  /** Reference to the source artifact (quiz/flow/project/sim id). */
  @Prop() evidenceRef?: string;

  // ── Phase 9 · Outcome Network ──
  /** Skill tags this event is evidence for (powers the Skill Passport skill graph). */
  @Prop({ type: [String], default: [] }) skills!: string[];
  /** How verified the event is — self < ai < system < mentor < certificate. */
  @Prop({ type: String, enum: VERIFICATION_LEVELS, default: 'system' })
  verificationLevel!: VerificationLevel;
  /** Whether the learner allows this event to appear on the public Skill Passport. */
  @Prop({ default: true }) visibleOnPassport!: boolean;

  /** When the verified event happened. */
  @Prop({ type: Date, default: () => new Date(), index: true }) at!: Date;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ user: 1, at: -1 });
LedgerEntrySchema.index({ user: 1, kind: 1 });
