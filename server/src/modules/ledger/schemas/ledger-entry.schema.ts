import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Verified learning-event kinds (Phase 8 · Proof-of-Learning Ledger). */
export const LEDGER_KINDS = [
  'node_completed',
  'quiz_passed',
  'mistake_resolved',
  'simulation_finished',
  'project_submitted',
  'week_completed',
  'flow_generated',
  'certificate_earned',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;

@Schema({ timestamps: true, collection: 'ledger_entries' })
export class LedgerEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: LEDGER_KINDS, required: true })
  kind!: LedgerKind;

  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) detail!: string;
  /** 0–100 score where relevant (quiz, simulation). */
  @Prop() score?: number;
  /** Reference to the source artifact (quiz/flow/project/sim id). */
  @Prop() evidenceRef?: string;
  /** When the verified event happened. */
  @Prop({ type: Date, default: () => new Date(), index: true }) at!: Date;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ user: 1, at: -1 });
