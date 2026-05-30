import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Difficulty, ItemStatus } from '../../../common/enums';

export type ProjectStatus = 'planning' | 'in_progress' | 'completed';
export type ProjectSource = 'goal' | 'roadmap' | 'agent';

@Schema({ _id: false })
export class ProjectTask {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  /** Kanban column: todo | in_progress | done. */
  @Prop({ type: String, enum: ItemStatus, default: ItemStatus.Todo })
  status!: ItemStatus;
  @Prop({ default: 0 }) order!: number;
  /** Phase grouping (e.g. "Setup", "Core features"). */
  @Prop({ default: '' }) phase!: string;
  @Prop({ default: 2 }) estimateHours!: number;
}
const ProjectTaskSchema = SchemaFactory.createForClass(ProjectTask);

@Schema({ _id: false })
export class ProjectMilestone {
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ type: [String], default: [] }) criteria!: string[];
  @Prop({ default: false }) reached!: boolean;
}
const ProjectMilestoneSchema = SchemaFactory.createForClass(ProjectMilestone);

/** Submission scaffold — links + notes a student attaches when done (feeds Phase-4 AI/mentor review). */
@Schema({ _id: false })
export class ProjectSubmission {
  @Prop() githubUrl?: string;
  @Prop() demoUrl?: string;
  @Prop() videoUrl?: string;
  @Prop({ default: '' }) notes!: string;
  @Prop() submittedAt?: Date;
}
const ProjectSubmissionSchema = SchemaFactory.createForClass(ProjectSubmission);

/** One actionable item in the AI review's improvement checklist (Phase 4 · B8). */
@Schema({ _id: false })
export class ReviewChecklistItem {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) text!: string;
  @Prop({ type: String, enum: ['high', 'medium', 'low'], default: 'medium' })
  severity!: 'high' | 'medium' | 'low';
  @Prop({ default: false }) done!: boolean;
}
const ReviewChecklistItemSchema = SchemaFactory.createForClass(ReviewChecklistItem);

/**
 * Automated AI review of a submitted project (Phase 4 · B8). Scores quality, architecture,
 * completeness and resume-readiness, with strengths and a toggleable improvement checklist.
 * Deterministic generator behind the AI abstraction (static code analysis is 🧱 / future).
 */
@Schema({ _id: false })
export class AiProjectReview {
  @Prop({ default: 0, min: 0, max: 100 }) qualityScore!: number;
  @Prop({ default: 0, min: 0, max: 100 }) architectureScore!: number;
  @Prop({ default: 0, min: 0, max: 100 }) completenessScore!: number;
  /** How resume-/portfolio-ready the project is (links, polish, scope). */
  @Prop({ default: 0, min: 0, max: 100 }) resumeScore!: number;
  @Prop({ default: 0, min: 0, max: 100 }) overallScore!: number;
  @Prop({ default: '' }) summary!: string;
  @Prop({ type: [String], default: [] }) strengths!: string[];
  @Prop({ type: [ReviewChecklistItemSchema], default: [] }) improvements!: ReviewChecklistItem[];
  @Prop() reviewedAt?: Date;
  @Prop({ default: '' }) model!: string;
}
const AiProjectReviewSchema = SchemaFactory.createForClass(AiProjectReview);

/** Human mentor review of a submission (complements the AI review from B8). */
@Schema({ _id: false })
export class MentorReview {
  @Prop({ type: Types.ObjectId, ref: 'User' }) reviewer?: Types.ObjectId;
  @Prop() reviewerName?: string;
  @Prop({ type: String, enum: ['approved', 'changes_requested'], default: 'changes_requested' })
  decision!: 'approved' | 'changes_requested';
  @Prop({ default: '' }) feedback!: string;
  @Prop({ min: 0, max: 100 }) score?: number;
  @Prop() reviewedAt?: Date;
}
const MentorReviewSchema = SchemaFactory.createForClass(MentorReview);

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  goal!: string;

  @Prop({ default: '' })
  summary!: string;

  @Prop({ type: [String], default: [] })
  techStack!: string[];

  @Prop({ type: [String], default: [] })
  features!: string[];

  @Prop({ type: [String], default: [] })
  learningGoals!: string[];

  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  difficulty!: Difficulty;

  @Prop({ default: 2 })
  estimatedWeeks!: number;

  @Prop({ type: String, enum: ['planning', 'in_progress', 'completed'], default: 'planning' })
  status!: ProjectStatus;

  @Prop({ type: String, enum: ['goal', 'roadmap', 'agent'], default: 'goal' })
  source!: ProjectSource;

  @Prop({ type: [ProjectTaskSchema], default: [] })
  tasks!: ProjectTask[];

  @Prop({ type: [ProjectMilestoneSchema], default: [] })
  milestones!: ProjectMilestone[];

  @Prop({ type: ProjectSubmissionSchema })
  submission?: ProjectSubmission;

  @Prop({ type: AiProjectReviewSchema })
  aiReview?: AiProjectReview;

  @Prop({ type: MentorReviewSchema })
  mentorReview?: MentorReview;

  @Prop({ default: 0, min: 0, max: 100 })
  progressPercentage!: number;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ user: 1, createdAt: -1 });
