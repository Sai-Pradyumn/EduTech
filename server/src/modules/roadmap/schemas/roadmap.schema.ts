import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Difficulty, RoadmapStatus } from '../../../common/enums';

@Schema({ _id: false })
export class WeekPlan {
  @Prop({ required: true }) weekNumber!: number;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) focus!: string;
  @Prop({ type: [String], default: [] }) topics!: string[];
  @Prop({ type: [String], default: [] }) tasks!: string[];
  @Prop({ type: [String], default: [] }) practiceItems!: string[];
  @Prop({ default: '' }) expectedOutcome!: string;
}
const WeekPlanSchema = SchemaFactory.createForClass(WeekPlan);

@Schema({ _id: false })
export class Milestone {
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ required: true }) targetWeek!: number;
  @Prop({ type: [String], default: [] }) completionCriteria!: string[];
}
const MilestoneSchema = SchemaFactory.createForClass(Milestone);

@Schema({ _id: false })
export class ProjectIdea {
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ default: '' }) difficulty!: string;
  @Prop({ type: [String], default: [] }) skillsCovered!: string[];
}
const ProjectIdeaSchema = SchemaFactory.createForClass(ProjectIdea);

@Schema({ _id: false })
export class AssessmentItem {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) week!: number;
  @Prop({ required: true }) type!: string;
  @Prop({ default: '' }) description!: string;
}
const AssessmentItemSchema = SchemaFactory.createForClass(AssessmentItem);

export type RoadmapDocument = HydratedDocument<Roadmap>;

@Schema({ timestamps: true })
export class Roadmap {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'StudentProfile' })
  studentProfile?: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  goal!: string;

  @Prop({ default: '' })
  overview!: string;

  @Prop({ default: '' })
  estimatedDuration!: string;

  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  difficulty!: Difficulty;

  @Prop({ type: [WeekPlanSchema], default: [] })
  weeklyPlan!: WeekPlan[];

  @Prop({ type: [MilestoneSchema], default: [] })
  milestones!: Milestone[];

  @Prop({ type: [ProjectIdeaSchema], default: [] })
  recommendedProjects!: ProjectIdea[];

  @Prop({ type: [AssessmentItemSchema], default: [] })
  assessmentPlan!: AssessmentItem[];

  @Prop({ type: [String], default: [] })
  dailyStudyPlan!: string[];

  @Prop({ type: [String], default: [] })
  successTips!: string[];

  @Prop({ type: String, enum: RoadmapStatus, default: RoadmapStatus.Active, index: true })
  status!: RoadmapStatus;

  @Prop({ default: 0, min: 0, max: 100 })
  progressPercentage!: number;

  @Prop({ type: [Number], default: [] })
  completedWeeks!: number[];

  @Prop({ type: [String], default: [] })
  completedTasks!: string[];
}

export const RoadmapSchema = SchemaFactory.createForClass(Roadmap);
