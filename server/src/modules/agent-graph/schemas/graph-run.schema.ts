import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GraphRunStatus = 'running' | 'succeeded' | 'failed';

export type GraphRunDocument = HydratedDocument<GraphRun>;

/** One executed node of a graph run. */
@Schema({ _id: false })
export class GraphStepResult {
  @Prop({ required: true }) key!: string;
  @Prop({ required: true }) label!: string;
  @Prop({ required: true }) agentType!: string;
  @Prop({ default: '' }) summary!: string;
  @Prop() sessionId?: string;
}
const GraphStepResultSchema = SchemaFactory.createForClass(GraphStepResult);

/**
 * Agent-graph run (Phase 3 · A9): a LangGraph-style multi-step workflow where each node runs
 * an agent through the Agent OS, threading one session for continuity. Gated by ENABLE_LANGGRAPH.
 */
@Schema({ timestamps: true, collection: 'agent_graph_runs' })
export class GraphRun {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  graph!: string;

  @Prop({ default: '' })
  input!: string;

  @Prop({ type: String, enum: ['running', 'succeeded', 'failed'], default: 'running' })
  status!: GraphRunStatus;

  @Prop({ type: [GraphStepResultSchema], default: [] })
  steps!: GraphStepResult[];

  @Prop() sessionId?: string;
  @Prop({ default: 0 }) latencyMs!: number;
  @Prop() error?: string;
}

export const GraphRunSchema = SchemaFactory.createForClass(GraphRun);
GraphRunSchema.index({ user: 1, createdAt: -1 });
