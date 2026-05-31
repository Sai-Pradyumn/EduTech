import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const PASSPORT_VISIBILITY = ['private', 'unlisted', 'public'] as const;
export type PassportVisibility = (typeof PASSPORT_VISIBILITY)[number];

/** Granular toggles for what a published passport exposes. */
@Schema({ _id: false })
export class PassportPublicSettings {
  @Prop({ default: true }) showScores!: boolean;
  @Prop({ default: true }) showProjects!: boolean;
  @Prop({ default: true }) showTimeline!: boolean;
  @Prop({ default: true }) showCertificates!: boolean;
  /** Only render skills/proof that carry mentor/certificate/system verification. */
  @Prop({ default: false }) verifiedOnly!: boolean;
}
const PassportPublicSettingsSchema = SchemaFactory.createForClass(
  PassportPublicSettings,
);

export type SkillPassportDocument = HydratedDocument<SkillPassport>;

/**
 * Phase 9 · Skill Passport — the learner's living, verified profile. Most of the passport is
 * COMPUTED on read by blending the Skill Twin, Proof Ledger, certificates and projects; this
 * document only persists identity + sharing settings + a cached snapshot for the public route.
 */
@Schema({ timestamps: true, collection: 'skill_passports' })
export class SkillPassport {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  /** URL slug for the public profile (e.g. /u/aarav-sharma-3f2a). Unique, lower-kebab. */
  @Prop({
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  username!: string;

  @Prop({ default: '' }) headline!: string;
  @Prop({ default: '' }) targetRole!: string;

  @Prop({
    type: String,
    enum: PASSPORT_VISIBILITY,
    default: 'private',
    index: true,
  })
  visibility!: PassportVisibility;

  @Prop({ type: PassportPublicSettingsSchema, default: () => ({}) })
  publicSettings!: PassportPublicSettings;

  /** Cached readiness at last recompute (for cheap dashboard reads / public route). */
  @Prop({ default: 0 }) readinessScore!: number;

  /** Cached snapshot of the skill graph at last recompute (kept small). */
  @Prop({
    type: [
      { skill: String, mastery: Number, confidence: Number, evidence: Number },
    ],
    default: [],
  })
  skillSnapshots!: {
    skill: string;
    mastery: number;
    confidence: number;
    evidence: number;
  }[];

  @Prop() lastComputedAt?: Date;
  @Prop() publishedAt?: Date;
}

export const SkillPassportSchema = SchemaFactory.createForClass(SkillPassport);
