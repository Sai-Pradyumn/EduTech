import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const SPACE_SOURCE_TYPES = [
  'document',
  'text',
  'url',
  'transcript',
  'voice_session',
  'visual',
  'roadmap',
  'project',
  'tutor_message',
] as const;
export type SpaceSourceType = (typeof SPACE_SOURCE_TYPES)[number];

export const SPACE_ARTIFACT_KINDS = [
  'summary',
  'flashcards',
  'audio_overview',
  'concept_map',
] as const;
export type SpaceArtifactKind = (typeof SPACE_ARTIFACT_KINDS)[number];

@Schema({ _id: false })
export class SpaceSource {
  @Prop({ required: true }) id!: string;
  @Prop({ type: String, enum: SPACE_SOURCE_TYPES, default: 'text' })
  type!: SpaceSourceType;
  @Prop({ required: true }) title!: string;
  /** Inline text content used for grounding (paste/transcript/url-extract). */
  @Prop({ default: '' }) text!: string;
  @Prop() url?: string;
  /** Reference id when the source points at another entity (doc/visual/voice session…). */
  @Prop() ref?: string;
  @Prop({ type: Date, default: () => new Date() }) addedAt!: Date;
}
const SpaceSourceSchema = SchemaFactory.createForClass(SpaceSource);

@Schema({ _id: false })
export class SpaceArtifact {
  @Prop({ required: true }) id!: string;
  @Prop({ type: String, enum: SPACE_ARTIFACT_KINDS }) kind!: SpaceArtifactKind;
  @Prop({ default: '' }) title!: string;
  /** markdown (summary/flashcards/audio script) or JSON (concept map). */
  @Prop({ default: '' }) content!: string;
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}
const SpaceArtifactSchema = SchemaFactory.createForClass(SpaceArtifact);

export type StudySpaceDocument = HydratedDocument<StudySpace>;

@Schema({ timestamps: true, collection: 'study_spaces' })
export class StudySpace {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  org?: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;

  @Prop({ type: [SpaceSourceSchema], default: [] }) sources!: SpaceSource[];
  @Prop({ type: [SpaceArtifactSchema], default: [] })
  artifacts!: SpaceArtifact[];

  @Prop({ type: [String], default: [] }) linkedFlowIds!: string[];
  @Prop({ type: [String], default: [] }) linkedVisualIds!: string[];
  @Prop({ type: [String], default: [] }) linkedQuizIds!: string[];
  @Prop({ type: [String], default: [] }) linkedVoiceSessionIds!: string[];

  @Prop({ type: Object, default: {} }) metadata!: Record<string, unknown>;
}

export const StudySpaceSchema = SchemaFactory.createForClass(StudySpace);
StudySpaceSchema.index({ user: 1, createdAt: -1 });
