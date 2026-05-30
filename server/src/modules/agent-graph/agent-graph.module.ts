import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { GraphRun, GraphRunSchema } from './schemas/graph-run.schema';
import { AgentGraphController } from './agent-graph.controller';
import { GraphExecutorService } from './graph-executor.service';

/**
 * Agent-graph executor (Phase 3 · A9): LangGraph-style multi-step workflows over the Agent OS.
 * Gated by ENABLE_LANGGRAPH. Reuses the orchestrator; records runs in `agent_graph_runs`.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: GraphRun.name, schema: GraphRunSchema }]), AgentsModule],
  controllers: [AgentGraphController],
  providers: [GraphExecutorService],
  exports: [GraphExecutorService],
})
export class AgentGraphModule {}
