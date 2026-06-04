import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkillTwinSnapshotDocument = HydratedDocument<SkillTwinSnapshot>;

/**
 * A daily scalar snapshot of the learner's Skill Twin — the twin itself is
 * computed-on-read and owns no state, so this is the one thing we persist to
 * give it a sense of history (readiness/health/risk trend over time).
 */
@Schema({ collection: 'skill_twin_snapshots' })
export class SkillTwinSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) at!: Date;
  @Prop({ default: 0 }) readiness!: number;
  @Prop({ default: 0 }) health!: number;
  @Prop({ default: 0 }) retentionRisk!: number;
  @Prop({ default: 0 }) burnoutRisk!: number;
  @Prop({ default: 'steady' }) pace!: string;
}

export const SkillTwinSnapshotSchema =
  SchemaFactory.createForClass(SkillTwinSnapshot);
SkillTwinSnapshotSchema.index({ user: 1, at: -1 });
