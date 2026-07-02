import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AgentType, Intent } from '../../../common/enums';

export type AgentSessionDocument = HydratedDocument<AgentSession>;

@Schema({ timestamps: true })
export class AgentSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: AgentType, default: AgentType.Tutor })
  agentType!: AgentType;

  @Prop({ default: 'New session' })
  title!: string;

  @Prop({ default: 'chat' })
  source!: string;

  /** Rolling LLM summary of older turns, so long chats stay coherent without a huge prompt. */
  @Prop({ default: '' })
  summary!: string;

  /** Pinned sessions sort to the top of every history list. */
  @Prop({ default: false })
  pinned!: boolean;

  @Prop({ index: true })
  lastMessageAt?: Date;
}
export const AgentSessionSchema = SchemaFactory.createForClass(AgentSession);

export type AgentMessageDocument = HydratedDocument<AgentMessage>;

@Schema({ timestamps: true })
export class AgentMessage {
  @Prop({
    type: Types.ObjectId,
    ref: 'AgentSession',
    required: true,
    index: true,
  })
  session!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ type: String, enum: AgentType })
  agentType?: AgentType;

  @Prop({ type: String, enum: Intent })
  intent?: Intent;

  @Prop({ default: '' })
  content!: string;

  /** AgentResponse visual blocks / actions / sources (typed at the API layer). */
  @Prop({ type: Array, default: [] })
  visualBlocks!: unknown[];

  @Prop({ type: Array, default: [] })
  actions!: unknown[];

  @Prop({ type: Array, default: [] })
  sources!: unknown[];

  @Prop({ type: [String], default: [] })
  followUpQuestions!: string[];

  @Prop({ type: [String], default: [] })
  recommendedNextActions!: string[];

  @Prop({ default: 1 })
  confidence!: number;
}
export const AgentMessageSchema = SchemaFactory.createForClass(AgentMessage);
