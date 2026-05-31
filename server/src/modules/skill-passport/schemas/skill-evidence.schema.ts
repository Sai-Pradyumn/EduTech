import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const EVIDENCE_SOURCE_TYPES = [
  'quiz',
  'project',
  'roadmap',
  'flow',
  'simulation',
  'voice',
  'mentor',
  'certificate',
  'mistake_repair',
  'manual',
  'link',
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_VERIFICATION = ['self', 'ai', 'mentor', 'system', 'certificate'] as const;
export type EvidenceVerification = (typeof EVIDENCE_VERIFICATION)[number];

export type SkillEvidenceDocument = HydratedDocument<SkillEvidence>;

/**
 * Phase 9 · A piece of proof attached to a skill. Most evidence is derived live from the ledger,
 * but learners can also attach manual artifacts (GitHub repos, demo links, external certs) which
 * are persisted here and merged into the passport's verified-proof section.
 */
@Schema({ timestamps: true, collection: 'skill_evidence' })
export class SkillEvidence {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, trim: true }) skill!: string;

  @Prop({ type: String, enum: EVIDENCE_SOURCE_TYPES, default: 'manual' })
  sourceType!: EvidenceSourceType;

  @Prop() sourceId?: string;
  @Prop({ min: 0, max: 100 }) score?: number;
  @Prop({ min: 0, max: 100 }) confidence?: number;

  @Prop({ type: String, enum: EVIDENCE_VERIFICATION, default: 'self' })
  verificationLevel!: EvidenceVerification;

  @Prop({ default: '' }) summary!: string;
  /** Optional external link (repo / demo / credential). */
  @Prop() url?: string;

  @Prop({ default: true }) visibleOnPassport!: boolean;
}

export const SkillEvidenceSchema = SchemaFactory.createForClass(SkillEvidence);
SkillEvidenceSchema.index({ user: 1, createdAt: -1 });
