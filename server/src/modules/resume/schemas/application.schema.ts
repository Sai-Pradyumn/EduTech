import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const APPLICATION_STATUS = ['saved', 'applied', 'interviewing', 'offer', 'rejected'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];

export type ApplicationDocument = HydratedDocument<Application>;

/** Phase 9 · A tracked job application + Asta's match analysis of the pasted JD. */
@Schema({ timestamps: true, collection: 'applications' })
export class Application {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) company!: string;
  @Prop({ required: true }) role!: string;
  @Prop({ default: '' }) jdText!: string;

  @Prop({ default: 0 }) matchScore!: number;
  @Prop({ type: [String], default: [] }) matchedSkills!: string[];
  @Prop({ type: [String], default: [] }) missingSkills!: string[];
  @Prop({ default: '' }) tailoredSummary!: string;
  @Prop({ type: [String], default: [] }) tailoredBullets!: string[];
  @Prop({ default: '' }) coverLetter!: string;
  @Prop({ default: '' }) prepPlan!: string;

  @Prop({ type: String, enum: APPLICATION_STATUS, default: 'saved', index: true })
  status!: ApplicationStatus;

  @Prop({ default: '' }) notes!: string;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);
ApplicationSchema.index({ user: 1, createdAt: -1 });
