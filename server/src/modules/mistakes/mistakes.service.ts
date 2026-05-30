import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PROGRESSION_EVENTS, QuizGradedEvent } from '../progression/progression.events';
import { FlowsService } from '../flows/flows.service';
import { Mistake, MistakeDocument, MistakeStatus } from './schemas/mistake.schema';
import { buildRepairPlan, severityToType } from './mistake-repair.generator';
import { CaptureMistakeDto } from './dto/mistake.dto';

@Injectable()
export class MistakesService {
  private readonly logger = new Logger(MistakesService.name);

  constructor(
    @InjectModel(Mistake.name) private readonly model: Model<MistakeDocument>,
    private readonly flows: FlowsService,
  ) {}

  // ───────────────────────── capture ─────────────────────────

  /** Auto-capture mistakes from a graded quiz (wrong topics → repair entries). */
  @OnEvent(PROGRESSION_EVENTS.quizGraded)
  async onQuizGraded(ev: QuizGradedEvent): Promise<void> {
    try {
      const topics =
        ev.topicScores?.filter((t) => t.severity >= 40) ??
        ev.weakTopics.map((t) => ({ topic: t, severity: Math.max(50, 100 - ev.score) }));
      for (const t of topics) {
        await this.upsert(ev.userId, t.topic, t.severity, 'quiz', ev.quizId);
      }
    } catch (err) {
      this.logger.warn(`Mistake capture failed: ${(err as Error).message}`);
    }
  }

  /** Create or strengthen a mistake entry for a concept (dedupes by concept, increments frequency). */
  private async upsert(
    userId: string,
    concept: string,
    severity: number,
    source: 'quiz' | 'tutor' | 'voice' | 'project' | 'rag' | 'roadmap' | 'manual',
    sourceId?: string,
  ): Promise<MistakeDocument> {
    const existing = await this.model.findOne({ user: new Types.ObjectId(userId), concept }).exec();
    if (existing) {
      existing.frequency += 1;
      existing.severity = Math.round((existing.severity + severity) / 2);
      existing.mistakeType = severityToType(existing.severity);
      existing.lastSeenAt = new Date();
      if (existing.status === 'resolved') {
        existing.status = 'open'; // it came back — reopen
        existing.resolvedAt = undefined;
      }
      return existing.save();
    }
    return this.model.create({
      user: new Types.ObjectId(userId),
      concept,
      topic: concept,
      mistakeType: severityToType(severity),
      severity,
      frequency: 1,
      source,
      sourceId,
      status: 'open',
      lastSeenAt: new Date(),
      linkedQuizId: source === 'quiz' ? sourceId : undefined,
    });
  }

  captureManual(userId: string, dto: CaptureMistakeDto): Promise<MistakeDocument> {
    return this.upsert(userId, dto.concept.trim(), dto.severity ?? 60, dto.source ?? 'manual', dto.sourceId);
  }

  // ───────────────────────── reads ─────────────────────────

  list(userId: string, status?: MistakeStatus): Promise<MistakeDocument[]> {
    const filter: Record<string, unknown> = { user: new Types.ObjectId(userId) };
    if (status) filter['status'] = status;
    return this.model.find(filter).sort({ status: 1, severity: -1, frequency: -1 }).exec();
  }

  async get(userId: string, id: string): Promise<MistakeDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Mistake not found');
    const m = await this.model.findById(id).exec();
    if (!m || m.user.toString() !== userId) throw new NotFoundException('Mistake not found');
    return m;
  }

  async stats(userId: string): Promise<{
    open: number;
    repairing: number;
    resolved: number;
    avgSeverity: number;
    topFocus: { id: string; concept: string; severity: number } | null;
    heatmap: { topic: string; severity: number; frequency: number; status: MistakeStatus }[];
  }> {
    const all = await this.model.find({ user: new Types.ObjectId(userId) }).exec();
    const open = all.filter((m) => m.status === 'open');
    const repairing = all.filter((m) => m.status === 'repairing');
    const resolved = all.filter((m) => m.status === 'resolved');
    const unresolved = [...open, ...repairing].sort((a, b) => b.severity - a.severity);
    const avgSeverity = unresolved.length
      ? Math.round(unresolved.reduce((s, m) => s + m.severity, 0) / unresolved.length)
      : 0;
    const top = unresolved[0];
    return {
      open: open.length,
      repairing: repairing.length,
      resolved: resolved.length,
      avgSeverity,
      topFocus: top ? { id: String(top._id), concept: top.concept, severity: top.severity } : null,
      heatmap: all
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 12)
        .map((m) => ({ topic: m.concept, severity: m.severity, frequency: m.frequency, status: m.status })),
    };
  }

  // ───────────────────────── repair ─────────────────────────

  /** Generate a concrete repair plan and move the mistake into "repairing". */
  async generateRepair(userId: string, id: string): Promise<MistakeDocument> {
    const m = await this.get(userId, id);
    const { correction, actions } = buildRepairPlan(m.concept, m.mistakeType);
    m.correction = correction;
    m.repairActions = actions;
    if (m.status === 'open') m.status = 'repairing';
    return m.save();
  }

  async updateStatus(userId: string, id: string, status: MistakeStatus): Promise<MistakeDocument> {
    const m = await this.get(userId, id);
    m.status = status;
    m.resolvedAt = status === 'resolved' ? new Date() : undefined;
    return m.save();
  }

  async toggleAction(userId: string, id: string, actionId: string, done: boolean): Promise<MistakeDocument> {
    const m = await this.get(userId, id);
    const a = m.repairActions.find((x) => x.id === actionId);
    if (!a) throw new NotFoundException('Repair action not found');
    a.done = done;
    m.markModified('repairActions');
    // If every action is done, auto-resolve.
    if (m.repairActions.length && m.repairActions.every((x) => x.done)) {
      m.status = 'resolved';
      m.resolvedAt = new Date();
    }
    return m.save();
  }

  /** Add a weak-area repair node for this mistake to the learner's active flow. */
  async repairFlow(userId: string, id: string): Promise<{ mistake: MistakeDocument; flowId: string | null; nodeId: string | null }> {
    const m = await this.get(userId, id);
    const active = await this.flows.findActive(userId);
    if (!active) return { mistake: m, flowId: null, nodeId: null };
    const { flow, nodeId } = await this.flows.addRepairNode(userId, String(active._id), m.concept);
    m.linkedFlowId = String(flow._id);
    if (m.status === 'open') m.status = 'repairing';
    const action = m.repairActions.find((a) => a.kind === 'flow_repair_node');
    if (action) action.done = true;
    m.markModified('repairActions');
    await m.save();
    return { mistake: m, flowId: String(flow._id), nodeId };
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const m = await this.get(userId, id);
    await m.deleteOne();
    return { ok: true };
  }
}
