import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AgentType } from '../../../common/enums';

export type AiUsageLogDocument = HydratedDocument<AiUsageLog>;

@Schema({ timestamps: true })
export class AiUsageLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: AgentType, required: true })
  agentType!: AgentType;

  @Prop({ required: true })
  provider!: string;

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
}

export const AiUsageLogSchema = SchemaFactory.createForClass(AiUsageLog);
