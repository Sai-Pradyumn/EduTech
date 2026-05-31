import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  Branch,
  CareerTarget,
  EducationLevel,
  LearningStyle,
  SkillLevel,
  TargetTimeline,
  TimePerDay,
} from '../../../common/enums';

export type StudentProfileDocument = HydratedDocument<StudentProfile>;

@Schema({ timestamps: true })
export class StudentProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ type: String, enum: EducationLevel, required: true })
  educationLevel!: EducationLevel;

  @Prop({ type: String, enum: Branch, required: true })
  branch!: Branch;

  @Prop({ type: String, enum: SkillLevel, required: true })
  currentSkillLevel!: SkillLevel;

  @Prop({ type: [String], default: [] })
  currentSkills!: string[];

  @Prop({ type: [String], default: [] })
  weakAreas!: string[];

  @Prop({ required: true })
  mainGoal!: string;

  @Prop({ type: String, enum: TimePerDay, required: true })
  availableTimePerDay!: TimePerDay;

  @Prop({ type: String, enum: TargetTimeline, required: true })
  targetTimeline!: TargetTimeline;

  @Prop({ type: String, enum: LearningStyle, required: true })
  preferredLearningStyle!: LearningStyle;

  @Prop({ default: 'English' })
  preferredLanguage!: string;

  @Prop({ type: String, enum: CareerTarget, required: true })
  careerTarget!: CareerTarget;

  @Prop({ default: false })
  onboardingCompleted!: boolean;
}

export const StudentProfileSchema =
  SchemaFactory.createForClass(StudentProfile);
