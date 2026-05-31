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
import { LedgerEntry, LedgerEntryDocument, LedgerKind } from './schemas/ledger-entry.schema';

export interface LedgerRecord {
  kind: LedgerKind;
  title: string;
  detail?: string;
  score?: number;
  evidenceRef?: string;
}

/**
 * Proof-of-Learning Ledger — a private, append-only timeline of VERIFIED learning events. Listens to
 * domain events (quiz pass / week / project) and exposes record() for the services that don't emit
 * events (flow-node completion, mistake resolution, simulation finish). Never throws into callers.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(@InjectModel(LedgerEntry.name) private readonly model: Model<LedgerEntryDocument>) {}

  async record(userId: string, entry: LedgerRecord): Promise<void> {
    try {
      await this.model.create({ user: new Types.ObjectId(userId), at: new Date(), ...entry });
    } catch (err) {
      this.logger.warn(`Ledger record failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(PROGRESSION_EVENTS.quizGraded)
  async onQuiz(ev: QuizGradedEvent): Promise<void> {
    if (ev.score >= 70) {
      await this.record(ev.userId, { kind: 'quiz_passed', title: `Passed quiz: ${ev.quizTitle}`, detail: `Scored ${ev.score}% on ${ev.topic}.`, score: ev.score, evidenceRef: ev.quizId });
    }
  }

  @OnEvent(PROGRESSION_EVENTS.weekCompleted)
  async onWeek(ev: WeekCompletedEvent): Promise<void> {
    await this.record(ev.userId, { kind: 'week_completed', title: `Completed week ${ev.weekNumber}`, detail: `${ev.roadmapTitle}${ev.nextWeekFocus ? ` — next: ${ev.nextWeekFocus}` : ''}.` });
  }

  @OnEvent(PROGRESSION_EVENTS.projectSubmitted)
  async onProject(ev: ProjectSubmittedEvent): Promise<void> {
    await this.record(ev.userId, { kind: 'project_submitted', title: `Submitted project: ${ev.projectTitle}`, evidenceRef: ev.projectId });
  }

  list(userId: string, limit = 50): Promise<LedgerEntryDocument[]> {
    return this.model.find({ user: new Types.ObjectId(userId) }).sort({ at: -1 }).limit(limit).exec();
  }

  async stats(userId: string): Promise<{ total: number; byKind: { kind: string; count: number }[]; activeDays: number; latestAt: string | null }> {
    const all = await this.model.find({ user: new Types.ObjectId(userId) }).sort({ at: -1 }).exec();
    const byKindMap = new Map<string, number>();
    const days = new Set<string>();
    all.forEach((e) => {
      byKindMap.set(e.kind, (byKindMap.get(e.kind) ?? 0) + 1);
      days.add(e.at.toISOString().slice(0, 10));
    });
    return {
      total: all.length,
      byKind: [...byKindMap.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
      activeDays: days.size,
      latestAt: all[0]?.at.toISOString() ?? null,
    };
  }

  /** Recent entries (for Learning Replay). */
  recent(userId: string, sinceMs: number, limit = 12): Promise<LedgerEntryDocument[]> {
    const since = new Date(Date.now() - sinceMs);
    return this.model.find({ user: new Types.ObjectId(userId), at: { $gte: since } }).sort({ at: -1 }).limit(limit).exec();
  }
}
