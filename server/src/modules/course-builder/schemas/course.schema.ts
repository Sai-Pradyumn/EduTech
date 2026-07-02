import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Difficulty } from '../../../common/enums';

export const COURSE_SOURCES = [
  'goal',
  'syllabus',
  'space',
  'flow',
  'roadmap',
  'outline',
] as const;
export type CourseSource = (typeof COURSE_SOURCES)[number];

export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_VISIBILITIES = ['private', 'org', 'cohort'] as const;
export type CourseVisibility = (typeof COURSE_VISIBILITIES)[number];

@Schema({ _id: false })
export class CourseLesson {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) title!: string;
  /** Short design brief (2–4 sentences) written at course-generation time. */
  @Prop({ default: '' }) content!: string;
  /** Full teachable lesson (markdown) — generated lazily on first open. */
  @Prop({ default: '' }) body!: string;
  @Prop() bodyGeneratedAt?: Date;
  @Prop({ default: 20 }) estimateMinutes!: number;
}
const CourseLessonSchema = SchemaFactory.createForClass(CourseLesson);

@Schema({ _id: false })
export class CourseModule {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) summary!: string;
  @Prop({ type: [CourseLessonSchema], default: [] }) lessons!: CourseLesson[];
  @Prop() linkedQuizId?: string;
  @Prop() linkedVisualId?: string;
  /** Spoken overview script for the module (voice overview). */
  @Prop({ default: '' }) voiceScript!: string;
}
const CourseModuleSchema = SchemaFactory.createForClass(CourseModule);

@Schema({ _id: false })
export class CourseProject {
  @Prop({ default: '' }) title!: string;
  @Prop({ default: '' }) brief!: string;
  @Prop() linkedProjectId?: string;
}
const CourseProjectSchema = SchemaFactory.createForClass(CourseProject);

export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true, collection: 'courses' })
export class Course {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  author!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  org?: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) goal!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ default: '' }) audience!: string;

  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  level!: Difficulty;

  @Prop({ type: String, enum: COURSE_SOURCES, default: 'goal' })
  source!: CourseSource;

  @Prop({ type: String, enum: COURSE_STATUSES, default: 'draft' })
  status!: CourseStatus;

  @Prop({ type: String, enum: COURSE_VISIBILITIES, default: 'private' })
  visibility!: CourseVisibility;

  @Prop({ type: [CourseModuleSchema], default: [] }) modules!: CourseModule[];
  @Prop({ type: CourseProjectSchema, default: () => ({}) })
  project!: CourseProject;
  @Prop({ type: [String], default: [] }) certificateCriteria!: string[];

  // ── Learner progress (Learn mode) ──
  /** Lesson ids the author-learner has completed. */
  @Prop({ type: [String], default: [] }) completedLessons!: string[];
  /** Last opened lesson — powers "continue where you left off". */
  @Prop() lastLessonId?: string;

  @Prop() linkedFlowId?: string;
  @Prop() publishedAt?: Date;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
CourseSchema.index({ author: 1, createdAt: -1 });
CourseSchema.index({ org: 1, status: 1 });
