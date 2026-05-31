import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { GRAPH_TEMPLATES, graphByName } from './graph-templates';
import { GraphRun, GraphRunDocument } from './schemas/graph-run.schema';

export interface GraphRunView {
  id: string;
  graph: string;
  input: string;
  status: string;
  sessionId?: string;
  latencyMs: number;
  steps: { key: string; label: string; agentType: string; summary: string }[];
  createdAt: string;
}

/**
 * Agent-graph executor (Phase 3 · A9): runs a named multi-step graph by invoking the Agent OS
 * once per node, threading a single session so later nodes inherit context. Records the run.
 * Gated by ENABLE_LANGGRAPH.
 */
@Injectable()
export class GraphExecutorService {
  constructor(
    @InjectModel(GraphRun.name) private readonly runs: Model<GraphRunDocument>,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return this.config.get<boolean>('flags.langgraph') ?? false;
  }

  status(): { enabled: boolean; graphs: number } {
    return { enabled: this.enabled, graphs: GRAPH_TEMPLATES.length };
  }

  listGraphs() {
    return GRAPH_TEMPLATES.map((g) => ({
      name: g.name,
      title: g.title,
      description: g.description,
      nodes: g.nodes.map((n) => ({
        key: n.key,
        label: n.label,
        agentType: n.agentType,
      })),
    }));
  }

  async run(
    userId: string,
    role: Role,
    graphName: string,
    input: string,
  ): Promise<GraphRunView> {
    if (!this.enabled)
      throw new ForbiddenException(
        'Agent-graph workflows are disabled. Set ENABLE_LANGGRAPH=true to enable them.',
      );
    const graph = graphByName(graphName);
    if (!graph) throw new BadRequestException(`Unknown graph "${graphName}".`);

    const startedAt = Date.now();
    const run = await this.runs.create({
      user: new Types.ObjectId(userId),
      graph: graph.name,
      input,
      status: 'running',
      steps: [],
    });

    let sessionId: string | undefined;
    try {
      for (const node of graph.nodes) {
        const result = await this.orchestrator.handle({
          userId,
          role,
          message: node.prompt(input),
          sessionId,
          agentType: node.agentType,
          source: 'chat',
        });
        sessionId = result.sessionId; // thread the session through subsequent nodes
        run.steps.push({
          key: node.key,
          label: node.label,
          agentType: result.response.agentType,
          summary: this.snippet(result.response.answer),
          sessionId,
        });
      }
      run.status = 'succeeded';
    } catch (err) {
      run.status = 'failed';
      run.error = (err as Error).message;
    }
    run.sessionId = sessionId;
    run.latencyMs = Date.now() - startedAt;
    await run.save();
    return this.view(run);
  }

  async list(userId: string): Promise<GraphRunView[]> {
    const runs = await this.runs
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return runs.map((r) => this.view(r));
  }

  async get(userId: string, id: string): Promise<GraphRunView> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Run not found');
    const run = await this.runs.findOne({
      _id: id,
      user: new Types.ObjectId(userId),
    });
    if (!run) throw new NotFoundException('Run not found');
    return this.view(run);
  }

  private snippet(markdown: string): string {
    return markdown
      .replace(/[#*_>`~|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
  }

  private view(r: GraphRunDocument): GraphRunView {
    return {
      id: String(r._id),
      graph: r.graph,
      input: r.input,
      status: r.status,
      sessionId: r.sessionId,
      latencyMs: r.latencyMs,
      steps: r.steps.map((s) => ({
        key: s.key,
        label: s.label,
        agentType: s.agentType,
        summary: s.summary,
      })),
      createdAt:
        (
          r as GraphRunDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }
}
