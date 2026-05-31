import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Difficulty } from '../../common/enums';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import { LedgerService } from '../ledger/ledger.service';
import { FlowArchitectService } from './flow-architect/flow-architect.service';
import { FlowBlueprintInput } from './flow-architect/generated-flow.types';
import {
  Flow,
  FlowDocument,
  FlowNode,
  FlowNodeType,
} from './schemas/flow.schema';
import {
  AddNodeDto,
  GenerateFlowDto,
  UpdateFlowDto,
  UpdateNodeDto,
} from './dto/flow.dto';

/** What the client should do when a node is "executed" (start a tutor/quiz/project/voice action). */
export interface NodeExecution {
  nodeId: string;
  kind:
    | 'tutor'
    | 'quiz'
    | 'project'
    | 'voice'
    | 'mentor'
    | 'knowledge'
    | 'simulation';
  route: string;
  prompt?: string;
  agentType?: string;
}

@Injectable()
export class FlowsService {
  constructor(
    @InjectModel(Flow.name) private readonly model: Model<FlowDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    private readonly profiles: StudentProfileService,
    private readonly architect: FlowArchitectService,
    private readonly ledger: LedgerService,
  ) {}

  // ───────────────────────── generation ─────────────────────────

  async generate(userId: string, dto: GenerateFlowDto): Promise<FlowDocument> {
    const profile = await this.profiles.findByUser(userId);
    const input: FlowBlueprintInput = {
      goal: dto.goal.trim(),
      skillLevel:
        dto.difficulty ??
        (profile?.currentSkillLevel as unknown as Difficulty) ??
        Difficulty.Beginner,
      currentSkills: profile?.currentSkills ?? [],
      weakAreas: profile?.weakAreas ?? [],
      targetRole: dto.targetRole ?? profile?.careerTarget,
      preferredStack: dto.preferredStack ?? [],
      dailyMinutes: dto.dailyMinutes,
      timelineWeeks: dto.timelineWeeks,
      learningStyle: dto.learningStyle ?? profile?.preferredLearningStyle,
      sourceType: 'generated',
    };
    const generated = await this.architect.generate(userId, input);
    const created = await this.model.create({
      user: new Types.ObjectId(userId),
      title: generated.title,
      goal: generated.goal,
      description: generated.description,
      sourceType: generated.sourceType,
      status: 'active',
      difficulty: generated.difficulty,
      nodes: generated.nodes,
      edges: generated.edges,
      timeline: generated.timeline,
      metadata: generated.metadata,
      progressPercentage: 0,
    });
    return created;
  }

  async fromRoadmap(userId: string, roadmapId: string): Promise<FlowDocument> {
    if (!Types.ObjectId.isValid(roadmapId))
      throw new NotFoundException('Roadmap not found');
    const roadmap = await this.roadmaps.findById(roadmapId).exec();
    if (!roadmap) throw new NotFoundException('Roadmap not found');
    if (roadmap.user.toString() !== userId)
      throw new ForbiddenException('Not your roadmap');
    const profile = await this.profiles.findByUser(userId);
    const input: FlowBlueprintInput = {
      goal: roadmap.goal,
      skillLevel:
        roadmap.difficulty ??
        (profile?.currentSkillLevel as unknown as Difficulty) ??
        Difficulty.Beginner,
      currentSkills: profile?.currentSkills ?? [],
      weakAreas: profile?.weakAreas ?? [],
      preferredStack: [],
      sourceType: 'roadmap',
      sourceId: roadmapId,
      roadmapTitle: roadmap.title,
      roadmapWeeks: roadmap.weeklyPlan.map((w) => ({
        weekNumber: w.weekNumber,
        focus: w.focus,
        topics: w.topics ?? [],
      })),
    };
    const generated = await this.architect.generate(userId, input);
    return this.model.create({
      user: new Types.ObjectId(userId),
      title: generated.title,
      goal: generated.goal,
      description: generated.description,
      sourceType: 'roadmap',
      sourceId: roadmapId,
      status: 'active',
      difficulty: generated.difficulty,
      nodes: generated.nodes,
      edges: generated.edges,
      timeline: generated.timeline,
      metadata: generated.metadata,
      progressPercentage: 0,
    });
  }

  // ───────────────────────── reads ─────────────────────────

  list(userId: string): Promise<FlowDocument[]> {
    return this.model
      .find({ user: new Types.ObjectId(userId), status: { $ne: 'archived' } })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async get(userId: string, id: string): Promise<FlowDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Flow not found');
    const flow = await this.model.findById(id).exec();
    if (!flow) throw new NotFoundException('Flow not found');
    this.assertOwner(flow, userId);
    return flow;
  }

  // ───────────────────────── mutations ─────────────────────────

  async update(
    userId: string,
    id: string,
    dto: UpdateFlowDto,
  ): Promise<FlowDocument> {
    const flow = await this.get(userId, id);
    if (dto.title !== undefined) flow.title = dto.title;
    if (dto.description !== undefined) flow.description = dto.description;
    if (dto.status !== undefined) flow.status = dto.status;
    return flow.save();
  }

  async addNode(
    userId: string,
    id: string,
    dto: AddNodeDto,
  ): Promise<FlowDocument> {
    const flow = await this.get(userId, id);
    const nodeId = `n_${Date.now().toString(36)}_${flow.nodes.length}`;
    const stage =
      dto.stage ?? Math.max(0, ...flow.nodes.map((n) => n.stage)) + 1;
    const node: FlowNode = {
      id: nodeId,
      type: dto.type,
      title: dto.title,
      summary: dto.summary ?? '',
      objective: dto.objective ?? '',
      difficulty: dto.difficulty ?? Difficulty.Beginner,
      estimatedMinutes: dto.estimatedMinutes ?? 30,
      masteryScore: 0,
      status: 'available',
      position: dto.position ?? { x: 120 + stage * 280, y: 120 },
      stage,
      prerequisites: dto.prerequisites ?? [],
      resources: [],
      agentHints: [],
      linkedKnowledgeDocumentIds: [],
      linkedVisualAssetIds: [],
      linkedVoiceSessionIds: [],
    };
    flow.nodes.push(node);
    this.recomputeStatuses(flow);
    return flow.save();
  }

  async updateNode(
    userId: string,
    id: string,
    nodeId: string,
    dto: UpdateNodeDto,
  ): Promise<FlowDocument> {
    const flow = await this.get(userId, id);
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) throw new NotFoundException('Node not found');
    const wasCompleted = node.status === 'completed';
    if (dto.title !== undefined) node.title = dto.title;
    if (dto.summary !== undefined) node.summary = dto.summary;
    if (dto.objective !== undefined) node.objective = dto.objective;
    if (dto.difficulty !== undefined) node.difficulty = dto.difficulty;
    if (dto.estimatedMinutes !== undefined)
      node.estimatedMinutes = dto.estimatedMinutes;
    if (dto.masteryScore !== undefined) node.masteryScore = dto.masteryScore;
    if (dto.status !== undefined) node.status = dto.status;
    if (dto.position !== undefined) node.position = dto.position;
    if (dto.prerequisites !== undefined) node.prerequisites = dto.prerequisites;
    if (dto.linkedQuizId !== undefined) node.linkedQuizId = dto.linkedQuizId;
    if (dto.linkedProjectId !== undefined)
      node.linkedProjectId = dto.linkedProjectId;
    flow.markModified('nodes');
    this.recomputeStatuses(flow);
    const saved = await flow.save();
    if (dto.status === 'completed' && !wasCompleted) {
      await this.ledger.record(userId, {
        kind: 'node_completed',
        title: `Completed: ${node.title}`,
        detail: `In flow "${flow.title}".`,
        evidenceRef: String(flow._id),
      });
    }
    return saved;
  }

  async removeNode(
    userId: string,
    id: string,
    nodeId: string,
  ): Promise<FlowDocument> {
    const flow = await this.get(userId, id);
    flow.nodes = flow.nodes.filter((n) => n.id !== nodeId);
    flow.edges = flow.edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
    flow.nodes.forEach(
      (n) => (n.prerequisites = n.prerequisites.filter((p) => p !== nodeId)),
    );
    flow.timeline.forEach(
      (b) => (b.nodeIds = b.nodeIds.filter((x) => x !== nodeId)),
    );
    this.recomputeStatuses(flow);
    return flow.save();
  }

  /** Mark a node started and tell the client where to go to do the work. */
  async executeNode(
    userId: string,
    id: string,
    nodeId: string,
  ): Promise<{ flow: FlowDocument; execution: NodeExecution }> {
    const flow = await this.get(userId, id);
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) throw new NotFoundException('Node not found');
    if (node.status === 'locked') {
      // Allow starting anyway, but it stays the learner's choice.
    }
    if (node.status !== 'completed') node.status = 'in_progress';
    flow.markModified('nodes');
    await flow.save();
    return { flow, execution: this.executionFor(node, flow) };
  }

  private executionFor(node: FlowNode, flow: FlowDocument): NodeExecution {
    const objective = node.objective || node.summary || node.title;
    switch (node.type) {
      case 'quiz':
      case 'checkpoint':
      case 'mastery_gate':
        return {
          nodeId: node.id,
          kind: 'quiz',
          route: '/app/quizzes',
          prompt: node.title,
        };
      case 'project':
        return {
          nodeId: node.id,
          kind: 'project',
          route: '/app/projects',
          prompt: node.title,
        };
      case 'voice_practice':
        return {
          nodeId: node.id,
          kind: 'voice',
          route: '/app/voice-room',
          prompt: objective,
        };
      case 'mentor_review':
        return {
          nodeId: node.id,
          kind: 'mentor',
          route: '/app/mentor-room',
          prompt: objective,
          agentType: 'mentor',
        };
      case 'simulation':
        return {
          nodeId: node.id,
          kind: 'simulation',
          route: '/app/voice-room',
          prompt: objective,
        };
      case 'document_source':
      case 'diagram':
      case 'image':
        return {
          nodeId: node.id,
          kind: 'knowledge',
          route: '/app/knowledge',
          prompt: node.title,
        };
      case 'weak_area_repair':
        return {
          nodeId: node.id,
          kind: 'tutor',
          route: '/app/tutor',
          prompt: `Help me repair my weak area: ${node.title.replace(/^Repair:\s*/, '')}. ${objective}`,
          agentType: 'doubt_solver',
        };
      default:
        return {
          nodeId: node.id,
          kind: 'tutor',
          route: '/app/tutor',
          prompt: `Teach me: ${node.title}. ${objective}`,
          agentType: 'tutor',
        };
    }
  }

  /** Re-derive unlock states + progress, and add repair nodes for any new profile weak areas. */
  async recalculate(userId: string, id: string): Promise<FlowDocument> {
    const flow = await this.get(userId, id);
    const profile = await this.profiles.findByUser(userId);
    const existingRepairs = new Set(
      flow.nodes
        .filter((n) => n.type === 'weak_area_repair')
        .map((n) => n.title.replace(/^Repair:\s*/, '').toLowerCase()),
    );
    const lastStage = Math.max(0, ...flow.nodes.map((n) => n.stage));
    (profile?.weakAreas ?? []).forEach((weak, i) => {
      if (existingRepairs.has(weak.toLowerCase())) return;
      const anchor = flow.nodes.find(
        (n) =>
          n.type === 'concept' &&
          n.title.toLowerCase().includes(weak.toLowerCase().split(' ')[0]),
      );
      const newId = `n_repair_${Date.now().toString(36)}_${i}`;
      flow.nodes.push({
        id: newId,
        type: 'weak_area_repair',
        title: `Repair: ${weak}`,
        summary: `Auto-added repair loop for "${weak}" (detected from recent activity).`,
        objective: `Turn "${weak}" from a weakness into a strength.`,
        difficulty: Difficulty.Intermediate,
        estimatedMinutes: 35,
        masteryScore: 0,
        status: 'available',
        position: { x: 120 + lastStage * 280, y: 120 + (4 + i) * 150 },
        stage: lastStage,
        prerequisites: anchor ? [anchor.id] : [],
        resources: [{ label: 'Start repair loop', kind: 'tutor' }],
        agentHints: [`Diagnose and repair misconceptions about ${weak}.`],
        linkedKnowledgeDocumentIds: [],
        linkedVisualAssetIds: [],
        linkedVoiceSessionIds: [],
      });
      if (anchor) {
        flow.edges.push({
          id: `e_repair_${Date.now().toString(36)}_${i}`,
          source: anchor.id,
          target: newId,
          relation: 'weak_area_patch',
          strength: 0.9,
          explanation: `Patches the weak area: ${weak}.`,
        });
      }
    });
    flow.markModified('nodes');
    flow.markModified('edges');
    this.recomputeStatuses(flow);
    return flow.save();
  }

  /** Most-recent active flow for a user (used by Mistake OS / Skill Twin). */
  async findActive(userId: string): Promise<FlowDocument | null> {
    return this.model
      .findOne({ user: new Types.ObjectId(userId), status: 'active' })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /** Add a weak-area repair node for a concept (Phase 8 · Mistake OS → flow). Returns node id. */
  async addRepairNode(
    userId: string,
    flowId: string,
    concept: string,
  ): Promise<{ flow: FlowDocument; nodeId: string }> {
    const flow = await this.get(userId, flowId);
    const lastStage = Math.max(0, ...flow.nodes.map((n) => n.stage));
    const lane = flow.nodes.filter((n) => n.stage === lastStage).length;
    const nodeId = `n_repair_${Date.now().toString(36)}`;
    const anchor = flow.nodes.find(
      (n) =>
        n.type === 'concept' &&
        n.title.toLowerCase().includes(concept.toLowerCase().split(' ')[0]),
    );
    flow.nodes.push({
      id: nodeId,
      type: 'weak_area_repair',
      title: `Repair: ${concept}`,
      summary: `Repair loop for "${concept}" (from a logged mistake).`,
      objective: `Turn "${concept}" from a weakness into a strength.`,
      difficulty: Difficulty.Intermediate,
      estimatedMinutes: 35,
      masteryScore: 0,
      status: 'available',
      position: { x: 120 + lastStage * 280, y: 120 + lane * 150 },
      stage: lastStage,
      prerequisites: anchor ? [anchor.id] : [],
      resources: [{ label: 'Start repair loop', kind: 'tutor' }],
      agentHints: [`Diagnose and repair misconceptions about ${concept}.`],
      linkedKnowledgeDocumentIds: [],
      linkedVisualAssetIds: [],
      linkedVoiceSessionIds: [],
    });
    if (anchor) {
      flow.edges.push({
        id: `e_repair_${Date.now().toString(36)}`,
        source: anchor.id,
        target: nodeId,
        relation: 'weak_area_patch',
        strength: 0.9,
        explanation: `Patches the weak area: ${concept}.`,
      });
    }
    flow.markModified('nodes');
    flow.markModified('edges');
    this.recomputeStatuses(flow);
    const saved = await flow.save();
    return { flow: saved, nodeId };
  }

  /** Attach a generated visual asset to a node (Phase 8 cross-module link). */
  async linkVisual(
    userId: string,
    flowId: string,
    nodeId: string,
    visualId: string,
  ): Promise<FlowDocument> {
    const flow = await this.get(userId, flowId);
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) throw new NotFoundException('Node not found');
    if (!node.linkedVisualAssetIds.includes(visualId))
      node.linkedVisualAssetIds.push(visualId);
    flow.markModified('nodes');
    return flow.save();
  }

  /** Export a portable JSON snapshot of the flow graph. */
  async export(userId: string, id: string): Promise<Record<string, unknown>> {
    const flow = await this.get(userId, id);
    return {
      title: flow.title,
      goal: flow.goal,
      description: flow.description,
      difficulty: flow.difficulty,
      progressPercentage: flow.progressPercentage,
      nodes: flow.nodes,
      edges: flow.edges,
      timeline: flow.timeline,
      metadata: flow.metadata,
      exportedAt: new Date().toISOString(),
    };
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const flow = await this.get(userId, id);
    flow.status = 'archived';
    await flow.save();
    return { ok: true };
  }

  // ───────────────────────── helpers ─────────────────────────

  /** A node unlocks when every prerequisite is completed; progress = completed / total. */
  private recomputeStatuses(flow: FlowDocument): void {
    const completed = new Set(
      flow.nodes.filter((n) => n.status === 'completed').map((n) => n.id),
    );
    for (const node of flow.nodes) {
      if (
        node.status === 'completed' ||
        node.status === 'skipped' ||
        node.status === 'in_progress'
      )
        continue;
      const ready = node.prerequisites.every((p) => completed.has(p));
      node.status = ready ? 'available' : 'locked';
    }
    const total = flow.nodes.length || 1;
    flow.progressPercentage = Math.round((completed.size / total) * 100);
    const gate = flow.nodes.find((n) => n.type === 'mastery_gate');
    if (gate && gate.status === 'completed' && flow.status === 'active')
      flow.status = 'completed';
    flow.markModified('nodes');
  }

  private assertOwner(flow: FlowDocument, userId: string): void {
    if (flow.user.toString() !== userId)
      throw new ForbiddenException('You do not have access to this flow');
  }
}

/** Node-type display reference (used by the export + agent). */
export const FLOW_NODE_TYPE_REF: FlowNodeType[] = [
  'concept',
  'prerequisite',
  'lesson',
  'practice',
  'quiz',
  'project',
  'checkpoint',
  'weak_area_repair',
  'mentor_review',
  'voice_practice',
  'simulation',
  'document_source',
  'diagram',
  'image',
  'mastery_gate',
];
