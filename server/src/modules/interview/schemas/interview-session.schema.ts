import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { INTERVIEW_TYPES, InterviewType } from '../interview-bank';

@Schema({ _id: false })
export class InterviewQA {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) question!: string;
  @Prop({ default: '' }) answer!: string;
  @Prop({ default: '' }) feedback!: string;
  @Prop() score?: number;
  @Prop({ default: false }) answered!: boolean;
}
const InterviewQASchema = SchemaFactory.createForClass(InterviewQA);

export type InterviewSessionDocument = HydratedDocument<InterviewSession>;

/** Phase 9 · Interview OS — a mock-interview session: questions, scored answers, a final report. */
@Schema({ timestamps: true, collection: 'interview_sessions' })
export class InterviewSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: INTERVIEW_TYPES, required: true })
  type!: InterviewType;

  @Prop({ default: '' }) role!: string;
  @Prop({ type: [InterviewQASchema], default: [] }) questions!: InterviewQA[];
  @Prop({ default: 0 }) currentIndex!: number;

  @Prop({ type: String, enum: ['active', 'finished'], default: 'active', index: true })
  status!: 'active' | 'finished';

  @Prop({ default: 0 }) communicationScore!: number;
  @Prop({ default: 0 }) technicalScore!: number;
  @Prop({ default: 0 }) confidenceScore!: number;
  @Prop({ default: 0 }) overallScore!: number;
  @Prop({ default: '' }) summary!: string;
  @Prop({ type: [String], default: [] }) strengths!: string[];
  @Prop({ type: [String], default: [] }) weakConcepts!: string[];
  @Prop() finishedAt?: Date;
}

export const InterviewSessionSchema = SchemaFactory.createForClass(InterviewSession);
InterviewSessionSchema.index({ user: 1, createdAt: -1 });
