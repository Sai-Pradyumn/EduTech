import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AssessmentItem,
  Milestone,
  ProjectIdea,
  WeekPlan,
} from './roadmap.schema';

export type RoadmapVersionDocument = HydratedDocument<RoadmapVersion>;

/**
 * One immutable snapshot of a roadmap's CONTENT, taken after every content
 * change (generate, week regeneration, chat edit, restore) — git-style history.
 * Progress (completed weeks/tasks, activity) is intentionally NOT versioned:
 * restoring an older plan never erases what the learner actually did.
 */
@Schema({ timestamps: true })
export class RoadmapVersion {
  @Prop({ type: Types.ObjectId, ref: 'Roadmap', required: true, index: true })
  roadmap!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Monotonic per-roadmap version number (v1 = as generated). */
  @Prop({ required: true })
  version!: number;

  /** Human cause of this version ("Generated", "Week 3 regenerated: …"). */
  @Prop({ required: true })
  label!: string;

  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) goal!: string;
  @Prop({ default: '' }) overview!: string;
  @Prop({ default: '' }) estimatedDuration!: string;
  @Prop({ default: '' }) difficulty!: string;
  @Prop({ type: Array, default: [] }) weeklyPlan!: WeekPlan[];
  @Prop({ type: Array, default: [] }) milestones!: Milestone[];
  @Prop({ type: Array, default: [] }) recommendedProjects!: ProjectIdea[];
  @Prop({ type: Array, default: [] }) assessmentPlan!: AssessmentItem[];
  @Prop({ type: [String], default: [] }) dailyStudyPlan!: string[];
  @Prop({ type: [String], default: [] }) successTips!: string[];

  createdAt?: Date;
}

export const RoadmapVersionSchema =
  SchemaFactory.createForClass(RoadmapVersion);
RoadmapVersionSchema.index({ roadmap: 1, version: -1 });
