import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const SESSION_TYPES = [
  'project_review',
  'interview_review',
  'roadmap_review',
  'portfolio_review',
  'general',
] as const;
export type MentorSessionType = (typeof SESSION_TYPES)[number];

export const SESSION_STATUS = [
  'requested',
  'accepted',
  'completed',
  'cancelled',
] as const;
export type MentorSessionStatus = (typeof SESSION_STATUS)[number];

export type MentorSessionDocument = HydratedDocument<MentorSession>;

/** Phase 9 · A mentoring session request between a student and a mentor. */
@Schema({ timestamps: true, collection: 'mentor_sessions_v2' })
export class MentorSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  mentor!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  student!: Types.ObjectId;

  @Prop({ type: String, enum: SESSION_TYPES, default: 'general' })
  type!: MentorSessionType;
  @Prop({
    type: String,
    enum: SESSION_STATUS,
    default: 'requested',
    index: true,
  })
  status!: MentorSessionStatus;

  @Prop({ default: '' }) message!: string;
  @Prop({ default: '' }) notes!: string;
  @Prop() linkedProjectId?: string;
  @Prop() linkedPortfolioUsername?: string;
  /** Agreed slot, set by the mentor when accepting (optional). */
  @Prop() scheduledAt?: Date;
}

export const MentorSessionSchema = SchemaFactory.createForClass(MentorSession);
MentorSessionSchema.index({ mentor: 1, createdAt: -1 });
MentorSessionSchema.index({ student: 1, createdAt: -1 });
