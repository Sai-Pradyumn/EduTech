import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AgentType } from '../../../common/enums';

export interface WorkflowStep {
  type: string;
  label: string;
  atMs: number;
}

export type AgentWorkflowLogDocument = HydratedDocument<AgentWorkflowLog>;

/** Observability: every agent run records its workflow steps for UI + analytics. */
@Schema({ timestamps: true })
export class AgentWorkflowLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AgentSession', index: true })
  session?: Types.ObjectId;

  @Prop({ type: String, enum: AgentType, required: true, index: true })
  agentType!: AgentType;

  @Prop({ type: Array, default: [] })
  steps!: WorkflowStep[];

  @Prop({ default: 0 })
  latencyMs!: number;

  @Prop({ default: true })
  success!: boolean;

  @Prop()
  error?: string;
}
export const AgentWorkflowLogSchema =
  SchemaFactory.createForClass(AgentWorkflowLog);
