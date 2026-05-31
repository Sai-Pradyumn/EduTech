import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Voice Room modes (Phase 8 · complete voice-native learning). */
export const VOICE_MODES = [
  'tutor',
  'viva',
  'interview',
  'doubt',
  'flow_builder',
  'revision',
  'mentor',
  'project_review',
] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const VOICE_SESSION_STATUSES = ['active', 'completed'] as const;
export type VoiceSessionStatus = (typeof VOICE_SESSION_STATUSES)[number];

@Schema({ _id: false })
export class VoiceTurn {
  @Prop({ type: String, enum: ['user', 'assistant'], required: true })
  role!: 'user' | 'assistant';
  @Prop({ required: true }) text!: string;
  @Prop({ type: Date, default: () => new Date() }) at!: Date;
}
const VoiceTurnSchema = SchemaFactory.createForClass(VoiceTurn);

export type VoiceSessionDocument = HydratedDocument<VoiceSession>;

@Schema({ timestamps: true, collection: 'voice_sessions' })
export class VoiceSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: VOICE_MODES, default: 'tutor' })
  mode!: VoiceMode;

  @Prop({ default: 'Voice session' }) title!: string;

  @Prop({ type: [VoiceTurnSchema], default: [] }) transcript!: VoiceTurn[];

  @Prop({ default: '' }) summary!: string;
  @Prop({ type: [String], default: [] }) extractedActions!: string[];

  @Prop() linkedFlowId?: string;
  @Prop() linkedQuizId?: string;
  @Prop() linkedRoadmapId?: string;
  @Prop() linkedProjectId?: string;

  @Prop({ default: 0 }) durationMs!: number;

  @Prop({ type: String, enum: VOICE_SESSION_STATUSES, default: 'active' })
  status!: VoiceSessionStatus;
}

export const VoiceSessionSchema = SchemaFactory.createForClass(VoiceSession);
VoiceSessionSchema.index({ user: 1, createdAt: -1 });
