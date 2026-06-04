import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LiveSessionStatus } from '../../../common/enums';

export type LiveSessionDocument = HydratedDocument<LiveSession>;

/** A student who joined the session (attendance record, embedded). */
@Schema({ _id: false })
export class SessionAttendee {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ default: '' })
  name!: string;

  @Prop({ type: Date, default: () => new Date() })
  joinedAt!: Date;
}
const SessionAttendeeSchema = SchemaFactory.createForClass(SessionAttendee);

/** AI recap generated from the host's session notes (summary + key points + assignment). */
@Schema({ _id: false })
export class SessionRecap {
  @Prop({ default: '' }) summary!: string;
  @Prop({ type: [String], default: [] }) keyPoints!: string[];
  @Prop({ default: '' }) assignmentTitle!: string;
  @Prop({ default: '' }) assignmentDescription!: string;
  /** Topic a student can launch a quiz on (deep-links to Quiz Studio). */
  @Prop({ default: '' }) suggestedQuizTopic!: string;
  @Prop() generatedAt?: Date;
}
const SessionRecapSchema = SchemaFactory.createForClass(SessionRecap);

/**
 * Live session (Phase 4 · B4): an org/cohort-scoped scheduled session a mentor hosts and
 * students join. Records attendance and, once ended, generates an AI recap (summary, key
 * points, assignment, suggested quiz topic) from the host's notes. The meeting URL is a
 * real joinable Jitsi Meet room (override the base with JITSI_BASE_URL).
 */
@Schema({ timestamps: true, collection: 'live_sessions' })
export class LiveSession {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organization!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cohort', index: true })
  cohort?: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  host!: Types.ObjectId;

  @Prop({ default: '' })
  hostName!: string;

  @Prop({ type: Date, required: true })
  scheduledStart!: Date;

  @Prop({ default: 60 })
  durationMins!: number;

  @Prop({
    type: String,
    enum: LiveSessionStatus,
    default: LiveSessionStatus.Scheduled,
  })
  status!: LiveSessionStatus;

  /** Joinable Jitsi Meet room URL (generated on create; override base via JITSI_BASE_URL). */
  @Prop({ default: '' })
  meetingUrl!: string;

  @Prop({ default: '' })
  notes!: string;

  @Prop({ type: [SessionAttendeeSchema], default: [] })
  attendees!: SessionAttendee[];

  @Prop({ type: SessionRecapSchema })
  recap?: SessionRecap;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const LiveSessionSchema = SchemaFactory.createForClass(LiveSession);
LiveSessionSchema.index({ organization: 1, scheduledStart: -1 });
