import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PROGRESSION_EVENTS,
  QuizGradedEvent,
  FlowRepairCompletedEvent,
} from '../progression/progression.events';
import { FlowsService } from '../flows/flows.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProjectsService } from '../projects/services/projects.service';
import {
  Mistake,
  MistakeDocument,
  MistakeStatus,
} from './schemas/mistake.schema';
import { buildRepairPlan, severityToType } from './mistake-repair.generator';
import { CaptureMistakeDto } from './dto/mistake.dto';

@Injectable()
export class MistakesService {
  private readonly logger = new Logger(MistakesService.name);

  constructor(
    @InjectModel(Mistake.name) private readonly model: Model<MistakeDocument>,
    private readonly flows: FlowsService,
    private readonly ledger: LedgerService,
    private readonly projects: ProjectsService,
  ) {}

  // ───────────────────────── capture ─────────────────────────

  /** Auto-capture mistakes from a graded quiz (wrong topics → repair entries). */
  @OnEvent(PROGRESSION_EVENTS.quizGraded)
  async onQuizGraded(ev: QuizGradedEvent): Promise<void> {
    try {
      const topics =
        ev.topicScores?.filter((t) => t.severity >= 40) ??
        ev.weakTopics.map((t) => ({
          topic: t,
          severity: Math.max(50, 100 - ev.score),
        }));
      for (const t of topics) {
        await this.upsert(ev.userId, t.topic, t.severity, 'quiz', ev.quizId);
      }
    } catch (err) {
      this.logger.warn(`Mistake capture failed: ${(err as Error).message}`);
    }
  }

  /** Close the loop: a mastered flow repair node resolves the matching open/repairing gap(s). */
  @OnEvent(PROGRESSION_EVENTS.flowRepairCompleted)
  async onFlowRepairCompleted(ev: FlowRepairCompletedEvent): Promise<void> {
    try {
      const target = ev.concept.trim().toLowerCase();
      if (!target) return;
      const open = await this.model
        .find({
          user: new Types.ObjectId(ev.userId),
          status: { $in: ['open', 'repairing'] },
        })
        .exec();
      const matches = open.filter((m) => {
        const c = m.concept.toLowerCase();
        return c === target || c.includes(target) || target.includes(c);
      });
      for (const m of matches) {
        m.status = 'resolved';
        m.resolvedAt = new Date();
        m.nextReviewAt = undefined;
        m.severity = Math.max(0, m.severity - 20);
        await m.save();
        await this.ledger.record(ev.userId, {
          kind: 'mistake_resolved',
          title: `Resolved: ${m.concept}`,
          detail: `Mastered the repair node in flow "${ev.flowTitle}".`,
        });
      }
    } catch (err) {
      this.logger.warn(`Flow-repair closure failed: ${(err as Error).message}`);
    }
  }

  /** Create or strengthen a mistake entry for a concept (dedupes by concept, increments frequency). */
  private async upsert(
    userId: string,
    concept: string,
    severity: number,
    source:
      | 'quiz'
      | 'tutor'
      | 'voice'
      | 'project'
      | 'rag'
      | 'roadmap'
      | 'manual',
    sourceId?: string,
  ): Promise<MistakeDocument> {
    const existing = await this.model
      .findOne({ user: new Types.ObjectId(userId), concept })
      .exec();
    if (existing) {
      existing.frequency += 1;
      existing.severity = Math.round((existing.severity + severity) / 2);
      existing.mistakeType = severityToType(existing.severity);
      existing.lastSeenAt = new Date();
      // It resurfaced — bring the spaced review forward and shorten the interval.
      existing.reviewInterval = 1;
      existing.nextReviewAt = new Date();
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
      // First review is due ~a day out, then it spaces out with each recall.
      reviewInterval: 1,
      reviewEase: 2.3,
      reviewCount: 0,
      nextReviewAt: this.addDays(new Date(), 1),
      linkedQuizId: source === 'quiz' ? sourceId : undefined,
    });
  }

  private addDays(from: Date, days: number): Date {
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  }

  captureManual(
    userId: string,
    dto: CaptureMistakeDto,
  ): Promise<MistakeDocument> {
    return this.upsert(
      userId,
      dto.concept.trim(),
      dto.severity ?? 60,
      dto.source ?? 'manual',
      dto.sourceId,
    );
  }

  // ───────────────────────── reads ─────────────────────────

  list(userId: string, status?: MistakeStatus): Promise<MistakeDocument[]> {
    const filter: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
    };
    if (status) filter['status'] = status;
    return this.model
      .find(filter)
      .sort({ status: 1, severity: -1, frequency: -1 })
      .exec();
  }

  async get(userId: string, id: string): Promise<MistakeDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Mistake not found');
    const m = await this.model.findById(id).exec();
    if (!m || m.user.toString() !== userId)
      throw new NotFoundException('Mistake not found');
    return m;
  }

  /**
   * Concepts due for a spaced review now: unresolved entries whose nextReviewAt
   * has passed (legacy rows with no date count as due). Hardest first.
   */
  due(userId: string): Promise<MistakeDocument[]> {
    return this.model
      .find({
        user: new Types.ObjectId(userId),
        status: { $ne: 'resolved' },
        $or: [
          { nextReviewAt: { $lte: new Date() } },
          { nextReviewAt: { $exists: false } },
          { nextReviewAt: null },
        ],
      })
      .sort({ severity: -1, nextReviewAt: 1 })
      .exec();
  }

  async stats(userId: string): Promise<{
    open: number;
    repairing: number;
    resolved: number;
    due: number;
    avgSeverity: number;
    topFocus: { id: string; concept: string; severity: number } | null;
    heatmap: {
      topic: string;
      severity: number;
      frequency: number;
      status: MistakeStatus;
    }[];
  }> {
    const all = await this.model
      .find({ user: new Types.ObjectId(userId) })
      .exec();
    const open = all.filter((m) => m.status === 'open');
    const repairing = all.filter((m) => m.status === 'repairing');
    const resolved = all.filter((m) => m.status === 'resolved');
    const now = Date.now();
    const due = all.filter(
      (m) =>
        m.status !== 'resolved' &&
        (!m.nextReviewAt || m.nextReviewAt.getTime() <= now),
    );
    const unresolved = [...open, ...repairing].sort(
      (a, b) => b.severity - a.severity,
    );
    const avgSeverity = unresolved.length
      ? Math.round(
          unresolved.reduce((s, m) => s + m.severity, 0) / unresolved.length,
        )
      : 0;
    const top = unresolved[0];
    return {
      open: open.length,
      repairing: repairing.length,
      resolved: resolved.length,
      due: due.length,
      avgSeverity,
      topFocus: top
        ? { id: String(top._id), concept: top.concept, severity: top.severity }
        : null,
      heatmap: all
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 12)
        .map((m) => ({
          topic: m.concept,
          severity: m.severity,
          frequency: m.frequency,
          status: m.status,
        })),
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

  async updateStatus(
    userId: string,
    id: string,
    status: MistakeStatus,
  ): Promise<MistakeDocument> {
    const m = await this.get(userId, id);
    const wasResolved = m.status === 'resolved';
    m.status = status;
    m.resolvedAt = status === 'resolved' ? new Date() : undefined;
    const saved = await m.save();
    if (status === 'resolved' && !wasResolved) {
      await this.ledger.record(userId, {
        kind: 'mistake_resolved',
        title: `Resolved: ${m.concept}`,
        detail: `Closed a ${m.mistakeType.replace('_', ' ')} gap.`,
      });
    }
    return saved;
  }

  /**
   * Record a spaced-review attempt and reschedule (SM-2-lite). A recall lengthens
   * the interval and eases the severity; a lapse resets the interval, lowers ease,
   * and bumps severity. A concept reviewed well enough auto-resolves.
   */
  async review(
    userId: string,
    id: string,
    recalled: boolean,
  ): Promise<MistakeDocument> {
    const m = await this.get(userId, id);
    const now = new Date();
    m.lastReviewedAt = now;
    m.reviewCount = (m.reviewCount ?? 0) + 1;

    if (recalled) {
      m.reviewEase = Math.min(3, (m.reviewEase ?? 2.3) + 0.1);
      m.reviewInterval = Math.max(
        1,
        Math.round((m.reviewInterval ?? 1) * m.reviewEase),
      );
      m.severity = Math.max(0, m.severity - 8);
      // Recalled comfortably a few times and no longer severe → consider it closed.
      if (m.reviewCount >= 3 && m.severity <= 15) {
        return this.resolveViaReview(userId, m);
      }
    } else {
      m.reviewEase = Math.max(1.3, (m.reviewEase ?? 2.3) - 0.2);
      m.reviewInterval = 1;
      m.severity = Math.min(100, m.severity + 6);
      m.mistakeType = severityToType(m.severity);
      if (m.status === 'resolved') {
        m.status = 'open';
        m.resolvedAt = undefined;
      }
    }
    m.nextReviewAt = this.addDays(now, m.reviewInterval);
    return m.save();
  }

  /** Resolve a mistake reached through a successful review streak (records to the Ledger). */
  private async resolveViaReview(
    userId: string,
    m: MistakeDocument,
  ): Promise<MistakeDocument> {
    const wasResolved = m.status === 'resolved';
    m.status = 'resolved';
    m.resolvedAt = new Date();
    m.nextReviewAt = undefined;
    const saved = await m.save();
    if (!wasResolved) {
      await this.ledger.record(userId, {
        kind: 'mistake_resolved',
        title: `Resolved: ${m.concept}`,
        detail: `Recalled reliably across spaced reviews.`,
      });
    }
    return saved;
  }

  /** Weakness-to-Project: generate a tiny project targeting this exact weak concept. */
  async repairProject(
    userId: string,
    id: string,
  ): Promise<{ mistake: MistakeDocument; projectId: string }> {
    const m = await this.get(userId, id);
    const project = await this.projects.generate(userId, {
      goal: `Tiny project to master ${m.concept}`,
    });
    if (m.status === 'open') m.status = 'repairing';
    await m.save();
    return { mistake: m, projectId: String(project._id) };
  }

  async toggleAction(
    userId: string,
    id: string,
    actionId: string,
    done: boolean,
  ): Promise<MistakeDocument> {
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
  async repairFlow(
    userId: string,
    id: string,
  ): Promise<{
    mistake: MistakeDocument;
    flowId: string | null;
    nodeId: string | null;
  }> {
    const m = await this.get(userId, id);
    const active = await this.flows.findActive(userId);
    if (!active) return { mistake: m, flowId: null, nodeId: null };
    const { flow, nodeId } = await this.flows.addRepairNode(
      userId,
      String(active._id),
      m.concept,
    );
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

  /** Wipe all mistakes for a user (Phase 8 · Skill Twin "reset learning memory"). Returns count. */
  async clearForUser(userId: string): Promise<number> {
    const res = await this.model
      .deleteMany({ user: new Types.ObjectId(userId) })
      .exec();
    return res.deletedCount ?? 0;
  }
}
