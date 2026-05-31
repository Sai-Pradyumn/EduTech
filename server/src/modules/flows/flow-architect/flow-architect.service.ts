import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { AIMessage } from '../../ai/interfaces/ai-provider.interface';
import { buildFlowBlueprint } from './flow-blueprint.generator';
import { FlowBlueprintInput, GeneratedFlow } from './generated-flow.types';
import { FLOW_EDGE_RELATIONS, FLOW_NODE_TYPES } from '../schemas/flow.schema';

/**
 * FlowArchitectAgent — converts a goal (+ profile, weak areas, optional roadmap) into a living
 * learning graph. Uses the LLM gateway for structured JSON when a key is configured, and always
 * falls back to a deterministic blueprint so Flow Studio works offline / with the mock provider.
 */
const FLOW_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['title', 'goal', 'nodes', 'edges'],
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    description: { type: 'string' },
    difficulty: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'title'],
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: FLOW_NODE_TYPES as unknown as string[],
          },
          title: { type: 'string' },
          summary: { type: 'string' },
          objective: { type: 'string' },
          difficulty: { type: 'string' },
          estimatedMinutes: { type: 'number' },
          stage: { type: 'number' },
          prerequisites: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        required: ['source', 'target', 'relation'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          relation: {
            type: 'string',
            enum: FLOW_EDGE_RELATIONS as unknown as string[],
          },
          strength: { type: 'number' },
          explanation: { type: 'string' },
        },
      },
    },
  },
};

@Injectable()
export class FlowArchitectService {
  readonly type = AgentType.Roadmap; // shares roadmap-class telemetry; no new enum needed
  private readonly logger = new Logger(FlowArchitectService.name);

  constructor(private readonly ai: AiService) {}

  async generate(
    userId: string,
    input: FlowBlueprintInput,
  ): Promise<GeneratedFlow> {
    const startedAt = Date.now();
    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: this.userPrompt(input) },
    ];

    let flow: GeneratedFlow;
    try {
      flow = await this.ai.generateStructuredOutput<GeneratedFlow>(
        messages,
        FLOW_SCHEMA,
        {
          mockFactory: () => buildFlowBlueprint(input),
          meta: {
            userId,
            agentType: AgentType.Roadmap,
            operation: 'flow.generate',
          },
        },
      );
      // Real-provider output may omit layout/derived fields — repair against the blueprint.
      flow = this.normalize(flow, input);
    } catch (err) {
      this.logger.error(`Flow generation failed: ${(err as Error).message}`);
      flow = buildFlowBlueprint(input);
    }

    if (!this.isValid(flow)) {
      this.logger.warn(
        'Flow output failed validation — using deterministic blueprint.',
      );
      flow = buildFlowBlueprint(input);
      if (!this.isValid(flow)) {
        throw new InternalServerErrorException(
          'Could not generate a valid flow. Please try again.',
        );
      }
    }

    await this.ai.logUsage({
      userId,
      agentType: this.type,
      operation: 'flow.generate',
      tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
      tokensOut: JSON.stringify(flow).length,
      latencyMs: Date.now() - startedAt,
    });
    return flow;
  }

  /** Ensure LLM output has valid layout + statuses; fall back per-field to the blueprint. */
  private normalize(
    flow: GeneratedFlow,
    input: FlowBlueprintInput,
  ): GeneratedFlow {
    if (!Array.isArray(flow?.nodes) || flow.nodes.length === 0)
      return buildFlowBlueprint(input);
    const blueprint = buildFlowBlueprint(input);
    const COL_W = 280;
    const ROW_H = 150;
    // Lay out by stage if positions are missing, and seed statuses so stage 0 is available.
    const byStage = new Map<number, number>();
    const nodes = flow.nodes.map((n, i) => {
      const stage = typeof n.stage === 'number' ? n.stage : 0;
      const lane = byStage.get(stage) ?? 0;
      byStage.set(stage, lane + 1);
      const hasPos = n.position && typeof n.position.x === 'number';
      return {
        ...n,
        difficulty: n.difficulty ?? input.skillLevel,
        estimatedMinutes: n.estimatedMinutes ?? 30,
        summary: n.summary ?? '',
        objective: n.objective ?? '',
        resources: n.resources ?? [],
        agentHints: n.agentHints ?? [],
        prerequisites: n.prerequisites ?? [],
        stage,
        status: n.status ?? (stage === 0 ? 'available' : 'locked'),
        position: hasPos
          ? n.position
          : { x: 120 + stage * COL_W, y: 120 + lane * ROW_H },
      };
    });
    return {
      title: flow.title || blueprint.title,
      goal: flow.goal || input.goal,
      description: flow.description || blueprint.description,
      difficulty: flow.difficulty ?? input.skillLevel,
      sourceType: flow.sourceType ?? input.sourceType ?? 'generated',
      nodes,
      edges: (flow.edges ?? []).map((e, i) => ({
        id: e.id || `e${i + 1}`,
        source: e.source,
        target: e.target,
        relation: e.relation ?? 'unlocks',
        strength: typeof e.strength === 'number' ? e.strength : 0.7,
        explanation: e.explanation ?? '',
      })),
      timeline: flow.timeline?.length ? flow.timeline : blueprint.timeline,
      metadata: { ...blueprint.metadata, ...(flow.metadata ?? {}) },
    };
  }

  private isValid(f: GeneratedFlow | undefined): boolean {
    return Boolean(
      f &&
      typeof f.title === 'string' &&
      f.title.length > 0 &&
      Array.isArray(f.nodes) &&
      f.nodes.length >= 3 &&
      Array.isArray(f.edges),
    );
  }

  private systemPrompt(): string {
    return [
      "You are Asta's Flow Architect. Convert a learning goal into a living dependency GRAPH, not a flat list.",
      `Use node types: ${FLOW_NODE_TYPES.join(', ')}.`,
      `Use edge relations: ${FLOW_EDGE_RELATIONS.join(', ')}.`,
      'Sequence from prerequisites → concepts → practice → checkpoints → project → voice viva → mastery_gate.',
      "Add weak_area_repair nodes for the learner's weak areas. Give every node a unique id, a stage index, and prerequisites referencing earlier node ids.",
      'Stage 0 nodes start "available"; the rest start "locked". Return strictly the GeneratedFlow JSON shape.',
    ].join(' ');
  }

  private userPrompt(i: FlowBlueprintInput): string {
    return JSON.stringify({
      goal: i.goal,
      skillLevel: i.skillLevel,
      currentSkills: i.currentSkills,
      weakAreas: i.weakAreas,
      targetRole: i.targetRole,
      preferredStack: i.preferredStack,
      dailyMinutes: i.dailyMinutes,
      timelineWeeks: i.timelineWeeks,
      learningStyle: i.learningStyle,
      roadmapTitle: i.roadmapTitle,
      roadmapWeeks: i.roadmapWeeks,
    });
  }
}
