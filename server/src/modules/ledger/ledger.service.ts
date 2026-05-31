import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PROGRESSION_EVENTS,
  ProjectSubmittedEvent,
  QuizGradedEvent,
  WeekCompletedEvent,
} from '../progression/progression.events';
import {
  LedgerEntry,
  LedgerEntryDocument,
  LedgerKind,
  VerificationLevel,
} from './schemas/ledger-entry.schema';

export interface LedgerRecord {
  kind: LedgerKind;
  title: string;
  detail?: string;
  score?: number;
  evidenceRef?: string;
  skills?: string[];
  verificationLevel?: VerificationLevel;
  visibleOnPassport?: boolean;
  at?: Date;
}

export interface LedgerSummary {
  total: number;
  byKind: { kind: string; count: number }[];
  byVerification: { level: VerificationLevel; count: number }[];
  activeDays: number;
  latestAt: string | null;
  verifiedCount: number; // mentor / certificate / system
  publicCount: number; // visibleOnPassport
  skills: { skill: string; count: number }[];
}

/**
 * Proof-of-Learning Ledger — a private, append-only timeline of VERIFIED learning events. Listens to
 * domain events (quiz pass / week / project) and exposes record() for the services that don't emit
 * events (flow-node completion, mistake resolution, simulation finish, reviews, interviews). Never
 * throws into callers. Phase 9 adds skill tags, a verification level and per-event passport visibility.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(@InjectModel(LedgerEntry.name) private readonly model: Model<LedgerEntryDocument>) {}

  async record(userId: string, entry: LedgerRecord): Promise<void> {
    try {
      await this.model.create({
        user: new Types.ObjectId(userId),
        at: entry.at ?? new Date(),
        skills: entry.skills ?? [],
        verificationLevel: entry.verificationLevel ?? 'system',
        visibleOnPassport: entry.visibleOnPassport ?? true,
        ...entry,
      });
    } catch (err) {
      this.logger.warn(`Ledger record failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(PROGRESSION_EVENTS.quizGraded)
  async onQuiz(ev: QuizGradedEvent): Promise<void> {
    if (ev.score >= 70) {
      await this.record(ev.userId, {
        kind: 'quiz_passed',
        title: `Passed quiz: ${ev.quizTitle}`,
        detail: `Scored ${ev.score}% on ${ev.topic}.`,
        score: ev.score,
        evidenceRef: ev.quizId,
        skills: ev.topic ? [ev.topic] : [],
        verificationLevel: 'system',
      });
    }
  }

  @OnEvent(PROGRESSION_EVENTS.weekCompleted)
  async onWeek(ev: WeekCompletedEvent): Promise<void> {
    await this.record(ev.userId, {
      kind: 'week_completed',
      title: `Completed week ${ev.weekNumber}`,
      detail: `${ev.roadmapTitle}${ev.nextWeekFocus ? ` — next: ${ev.nextWeekFocus}` : ''}.`,
      verificationLevel: 'system',
    });
  }

  @OnEvent(PROGRESSION_EVENTS.projectSubmitted)
  async onProject(ev: ProjectSubmittedEvent): Promise<void> {
    await this.record(ev.userId, {
      kind: 'project_submitted',
      title: `Submitted project: ${ev.projectTitle}`,
      evidenceRef: ev.projectId,
      verificationLevel: 'self',
    });
  }

  list(userId: string, limit = 100): Promise<LedgerEntryDocument[]> {
    return this.model.find({ user: new Types.ObjectId(userId) }).sort({ at: -1 }).limit(limit).exec();
  }

  /** Only the events the learner has chosen to publish on their Skill Passport / public profile. */
  listPublic(userId: string, limit = 60): Promise<LedgerEntryDocument[]> {
    return this.model
      .find({ user: new Types.ObjectId(userId), visibleOnPassport: true })
      .sort({ at: -1 })
      .limit(limit)
      .exec();
  }

  async setVisibility(userId: string, id: string, visible: boolean): Promise<{ ok: true }> {
    await this.model
      .updateOne({ _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) }, { $set: { visibleOnPassport: visible } })
      .exec();
    return { ok: true };
  }

  async stats(userId: string): Promise<{ total: number; byKind: { kind: string; count: number }[]; activeDays: number; latestAt: string | null }> {
    const s = await this.summary(userId);
    return { total: s.total, byKind: s.byKind, activeDays: s.activeDays, latestAt: s.latestAt };
  }

  /** Rich aggregate for the Skill Passport / Proof Ledger cockpit. */
  async summary(userId: string): Promise<LedgerSummary> {
    const all = await this.model.find({ user: new Types.ObjectId(userId) }).sort({ at: -1 }).exec();
    const byKindMap = new Map<string, number>();
    const byVerMap = new Map<VerificationLevel, number>();
    const skillMap = new Map<string, number>();
    const days = new Set<string>();
    let verifiedCount = 0;
    let publicCount = 0;
    all.forEach((e) => {
      byKindMap.set(e.kind, (byKindMap.get(e.kind) ?? 0) + 1);
      byVerMap.set(e.verificationLevel, (byVerMap.get(e.verificationLevel) ?? 0) + 1);
      days.add(e.at.toISOString().slice(0, 10));
      (e.skills ?? []).forEach((sk) => skillMap.set(sk, (skillMap.get(sk) ?? 0) + 1));
      if (e.verificationLevel === 'mentor' || e.verificationLevel === 'certificate' || e.verificationLevel === 'system') verifiedCount += 1;
      if (e.visibleOnPassport) publicCount += 1;
    });
    return {
      total: all.length,
      byKind: [...byKindMap.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
      byVerification: [...byVerMap.entries()].map(([level, count]) => ({ level, count })).sort((a, b) => b.count - a.count),
      activeDays: days.size,
      latestAt: all[0]?.at.toISOString() ?? null,
      verifiedCount,
      publicCount,
      skills: [...skillMap.entries()].map(([skill, count]) => ({ skill, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    };
  }

  /** Recent entries (for Learning Replay). */
  recent(userId: string, sinceMs: number, limit = 12): Promise<LedgerEntryDocument[]> {
    const since = new Date(Date.now() - sinceMs);
    return this.model.find({ user: new Types.ObjectId(userId), at: { $gte: since } }).sort({ at: -1 }).limit(limit).exec();
  }
}
