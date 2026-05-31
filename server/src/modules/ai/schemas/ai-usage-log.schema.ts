import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AgentType } from '../../../common/enums';

export type AiUsageLogDocument = HydratedDocument<AiUsageLog>;

@Schema({ timestamps: true })
export class AiUsageLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Org attribution for cost-by-org reporting (Phase 10 · M2). */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  org?: Types.ObjectId;

  @Prop({ type: String, enum: AgentType, required: true })
  agentType!: AgentType;

  /** Product feature/module that triggered the call (tutor, flow, visual, quiz…). */
  @Prop({ default: 'tutor', index: true })
  feature!: string;

  @Prop({ required: true })
  provider!: string;

  /** Concrete model id used (when the gateway exposes it). */
  @Prop({ default: '' })
  model!: string;

  /** Multi-provider strategy: fallback | parallel | refine. */
  @Prop({ default: 'fallback' })
  strategy!: string;

  @Prop({ required: true })
  operation!: string;

  @Prop({ default: 0 })
  tokensIn!: number;

  @Prop({ default: 0 })
  tokensOut!: number;

  @Prop({ default: 0 })
  costUsd!: number;

  @Prop({ default: 0 })
  latencyMs!: number;

  /** Outcome of the call for error-rate / fallback dashboards. */
  @Prop({ default: 'success', enum: ['success', 'error', 'fallback'] })
  status!: string;

  @Prop({ default: false })
  fallbackUsed!: boolean;

  @Prop()
  errorCode?: string;

  @Prop({ default: true })
  validationPassed!: boolean;
}

export const AiUsageLogSchema = SchemaFactory.createForClass(AiUsageLog);
AiUsageLogSchema.index({ feature: 1, createdAt: -1 });
AiUsageLogSchema.index({ org: 1, createdAt: -1 });
