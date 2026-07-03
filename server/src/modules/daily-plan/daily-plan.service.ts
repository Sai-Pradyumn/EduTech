import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoadmapStatus } from '../../common/enums';
import { FlowsService } from '../flows/flows.service';
import { LedgerService } from '../ledger/ledger.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import {
  DailyItem,
  DailyPlan,
  DailyPlanDocument,
  DailyPlanMode,
} from './schemas/daily-plan.schema';

@Injectable()
export class DailyPlanService {
  constructor(
    @InjectModel(DailyPlan.name)
    private readonly model: Model<DailyPlanDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    private readonly flows: FlowsService,
    private readonly mistakes: MistakesService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * The learner's "today" as YYYY-MM-DD. When the caller passes their IANA zone
   * (the client sends it as `x-timezone`), the day boundary — which drives the
   * streak, carry-over and today's plan — follows their wall clock, not the
   * server's UTC. Falls back to UTC when no/invalid zone is given.
   */
  private today(tz?: string): string {
    if (tz) {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
      } catch {
        /* invalid zone → UTC */
      }
    }
    return new Date().toISOString().slice(0, 10);
  }

  async getToday(userId: string, tz?: string): Promise<DailyPlanDocument> {
    const date = this.today(tz);
    const existing = await this.model
      .findOne({ user: new Types.ObjectId(userId), date })
      .exec();
    return existing ?? this.generate(userId, 'normal', tz);
  }

  /** Build today's plan from the active flow, open mistakes, the roadmap and a quiz nudge. */
  async generate(
    userId: string,
    mode: DailyPlanMode,
    tz?: string,
  ): Promise<DailyPlanDocument> {
    const date = this.today(tz);
    const prev = await this.model
      .findOne({ user: new Types.ObjectId(userId), date })
      .exec();
    const doneKeys = new Set(
      (prev?.items ?? [])
        .filter((i) => i.done)
        .map((i) => i.sourceId ?? i.title),
    );

    const [activeFlow, openMistakes, dueReviews, roadmap] = await Promise.all([
      this.flows.findActive(userId),
      this.mistakes.list(userId, 'open'),
      this.mistakes.due(userId),
      this.roadmaps
        .findOne({
          user: new Types.ObjectId(userId),
          status: RoadmapStatus.Active,
        })
        .sort({ updatedAt: -1 })
        .exec(),
    ]);

    const items: DailyItem[] = [];
    const add = (it: Omit<DailyItem, 'done'>) =>
      items.push({ ...it, done: doneKeys.has(it.sourceId ?? it.title) });

    if (mode === 'burnout_recovery') {
      add({
        id: 'i_rev',
        kind: 'revision',
        title: 'Gentle 10-min revision of something you already know',
        reason: 'Burnout recovery — rebuild momentum without pressure.',
        route: '/app/tutor',
        estimateMinutes: 10,
      });
      return this.persist(userId, date, mode, items);
    }

    if (mode === 'exam') {
      add({
        id: 'i_quiz',
        kind: 'quiz',
        title: 'Timed practice quiz',
        reason: 'Exam tomorrow — simulate test conditions.',
        route: '/app/quizzes',
        estimateMinutes: 25,
      });
      openMistakes.slice(0, 2).forEach((m, i) =>
        add({
          id: `i_m${i}`,
          kind: 'mistake',
          title: `Cram-repair: ${m.concept}`,
          reason: `Open gap at severity ${m.severity}.`,
          route: '/app/mistakes',
          estimateMinutes: 15,
          sourceId: String(m._id),
        }),
      );
      add({
        id: 'i_sim',
        kind: 'revision',
        title: 'One viva simulation on your weakest topic',
        reason: 'Active recall under pressure beats re-reading.',
        route: '/app/simulations',
        estimateMinutes: 15,
      });
      return this.persist(userId, date, mode, items);
    }

    // normal + quick share the same candidate pool; quick trims to ~20 min.
    const nextNode = activeFlow?.nodes.find(
      (n) => n.status === 'available' || n.status === 'in_progress',
    );
    if (nextNode && activeFlow) {
      add({
        id: 'i_flow',
        kind: 'flow_node',
        title: nextNode.title,
        reason: `Next step in "${activeFlow.title}".`,
        route: `/app/flows/${String(activeFlow._id)}`,
        estimateMinutes: nextNode.estimatedMinutes || 30,
        sourceId: nextNode.id,
      });
    }
    // Scheduled spaced reviews come first — they are time-sensitive by design.
    if (dueReviews[0]) {
      const r = dueReviews[0];
      add({
        id: 'i_review',
        kind: 'mistake',
        title: `Spaced review: ${r.concept}`,
        reason: `Due today — recalling it now locks it into long-term memory (interval ${r.reviewInterval ?? 1}d).`,
        route: '/app/mistakes?filter=due',
        estimateMinutes: 10,
        sourceId: `review:${String(r._id)}`,
      });
    }
    const topOpen = openMistakes.find(
      (m) => String(m._id) !== String(dueReviews[0]?._id ?? ''),
    );
    if (topOpen) {
      add({
        id: 'i_mistake',
        kind: 'mistake',
        title: `Repair: ${topOpen.concept}`,
        reason: `Highest open gap (severity ${topOpen.severity}).`,
        route: '/app/mistakes',
        estimateMinutes: 20,
        sourceId: String(topOpen._id),
      });
    }
    if (roadmap) {
      const week = roadmap.weeklyPlan.find(
        (w) => !roadmap.completedWeeks.includes(w.weekNumber),
      );
      if (week)
        add({
          id: 'i_road',
          kind: 'revision',
          title: `Roadmap · ${week.focus}`,
          reason: `Week ${week.weekNumber} of "${roadmap.title}".`,
          route: `/app/roadmap/${String(roadmap._id)}`,
          estimateMinutes: 30,
          sourceId: `week-${week.weekNumber}`,
        });
    }
    add({
      id: 'i_quiz',
      kind: 'quiz',
      title: 'Quick mastery check',
      reason: 'Lock in what you studied with a short quiz.',
      route: '/app/quizzes',
      estimateMinutes: 15,
    });

    const trimmed =
      mode === 'quick' ? this.trimToBudget(items, 20) : items.slice(0, 5);
    return this.persist(userId, date, mode, trimmed);
  }

  async completeItem(
    userId: string,
    itemId: string,
    tz?: string,
  ): Promise<DailyPlanDocument> {
    const plan = await this.getToday(userId, tz);
    const item = plan.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Plan item not found');
    item.done = !item.done;
    plan.markModified('items');

    // First time the whole plan is finished, record a verified proof event.
    const allDone = plan.items.length > 0 && plan.items.every((i) => i.done);
    if (allDone && !plan.completedLoggedAt) {
      plan.completedLoggedAt = new Date();
      await this.ledger.record(userId, {
        kind: 'daily_plan_completed',
        title: `Completed daily plan (${plan.items.length} items)`,
        detail: `${plan.mode} mode · ${plan.totalMinutes} min of focused learning.`,
        evidenceRef: String(plan._id),
        verificationLevel: 'system',
      });
    }
    return plan.save();
  }

  /** Append a learner-chosen custom item to today's plan (chat command). */
  async addItem(
    userId: string,
    title: string,
    estimateMinutes = 20,
    tz?: string,
  ): Promise<DailyPlanDocument> {
    const plan = await this.getToday(userId, tz);
    plan.items.push({
      id: `i_c_${Date.now().toString(36)}`,
      kind: 'revision',
      title: title.slice(0, 120),
      reason: 'Added by you.',
      route: '/app/today',
      estimateMinutes: Math.max(5, Math.min(120, Math.round(estimateMinutes))),
      done: false,
    });
    plan.totalMinutes = plan.items.reduce(
      (s, i) => s + (i.estimateMinutes || 0),
      0,
    );
    plan.markModified('items');
    return plan.save();
  }

  /** Persist a learner-chosen item order (drag-to-reorder on the Today screen). */
  async reorder(
    userId: string,
    itemIds: string[],
    tz?: string,
  ): Promise<DailyPlanDocument> {
    const plan = await this.getToday(userId, tz);
    const byId = new Map(plan.items.map((i) => [i.id, i]));
    const reordered = itemIds
      .map((id) => byId.get(id))
      .filter((i): i is DailyItem => !!i);
    // Append any items the client didn't mention so nothing is silently dropped.
    for (const it of plan.items)
      if (!itemIds.includes(it.id)) reordered.push(it);
    plan.items = reordered;
    plan.markModified('items');
    return plan.save();
  }

  /** Attach (or clear) a short note on a single plan item. */
  async setItemNote(
    userId: string,
    itemId: string,
    note: string,
    tz?: string,
  ): Promise<DailyPlanDocument> {
    const plan = await this.getToday(userId, tz);
    const item = plan.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Plan item not found');
    item.note = note.slice(0, 500);
    plan.markModified('items');
    return plan.save();
  }

  /** Save the end-of-day reflection (mood 1–5 and/or a one-line note) on today's plan. */
  async setReflection(
    userId: string,
    mood: number | undefined,
    reflection: string | undefined,
    tz?: string,
  ): Promise<DailyPlanDocument> {
    const plan = await this.getToday(userId, tz);
    if (mood !== undefined)
      plan.mood = Math.min(5, Math.max(1, Math.round(mood)));
    if (reflection !== undefined) plan.reflection = reflection.slice(0, 280);
    return plan.save();
  }

  /**
   * Pull yesterday's unfinished items into today's plan so nothing silently
   * drops off. Skips items already present today (matched on sourceId/title)
   * and is safe to run more than once.
   */
  async carryOver(userId: string, tz?: string): Promise<DailyPlanDocument> {
    const today = await this.getToday(userId, tz);
    const dayMs = 86_400_000;
    const yStr = new Date(
      new Date(`${today.date}T00:00:00.000Z`).getTime() - dayMs,
    )
      .toISOString()
      .slice(0, 10);
    const yesterday = await this.model
      .findOne({ user: new Types.ObjectId(userId), date: yStr })
      .exec();
    if (!yesterday) return today;

    const existingKeys = new Set(today.items.map((i) => i.sourceId ?? i.title));
    const carried = yesterday.items.filter(
      (i) => !i.done && !existingKeys.has(i.sourceId ?? i.title),
    );
    if (!carried.length) return today;

    for (const it of carried) {
      today.items.push({
        id: `carry_${it.id}`,
        kind: it.kind,
        title: it.title,
        reason: `Carried over from yesterday · ${it.reason}`,
        route: it.route,
        estimateMinutes: it.estimateMinutes,
        done: false,
        sourceId: it.sourceId,
        note: it.note,
      });
    }
    today.totalMinutes = today.items.reduce((s, i) => s + i.estimateMinutes, 0);
    today.markModified('items');
    return today.save();
  }

  recalculate(userId: string, tz?: string): Promise<DailyPlanDocument> {
    return this.generate(userId, 'normal', tz);
  }

  /**
   * Learning streak from completed daily plans. A day "counts" when the learner
   * finished at least one plan item. The current streak is still alive if today
   * isn't done yet but yesterday was (you have until end of day to keep it).
   */
  async streak(
    userId: string,
    tz?: string,
  ): Promise<{
    current: number;
    best: number;
    activeToday: boolean;
    totalActiveDays: number;
  }> {
    const plans = await this.model
      .find({ user: new Types.ObjectId(userId) }, { date: 1, items: 1 })
      .sort({ date: -1 })
      .limit(400)
      .exec();

    // Set of yyyy-mm-dd dates with ≥1 completed item.
    const active = new Set<string>(
      plans.filter((p) => p.items.some((i) => i.done)).map((p) => p.date),
    );
    const totalActiveDays = active.size;

    const dayMs = 86_400_000;
    const key = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = this.today(tz);
    const activeToday = active.has(todayStr);

    // Current streak: walk back from today (or yesterday if today not yet done).
    let current = 0;
    const cursor = new Date(`${todayStr}T00:00:00.000Z`);
    if (!activeToday) cursor.setTime(cursor.getTime() - dayMs); // grace: count from yesterday
    while (active.has(key(cursor))) {
      current++;
      cursor.setTime(cursor.getTime() - dayMs);
    }

    // Best streak: longest run of consecutive active dates.
    const sorted = [...active].sort();
    let best = 0;
    let run = 0;
    let prevTime: number | null = null;
    for (const ds of sorted) {
      const t = new Date(`${ds}T00:00:00.000Z`).getTime();
      run = prevTime !== null && t - prevTime === dayMs ? run + 1 : 1;
      if (run > best) best = run;
      prevTime = t;
    }

    return {
      current,
      best: Math.max(best, current),
      activeToday,
      totalActiveDays,
    };
  }

  /**
   * Per-day activity for the last `days` days (oldest→newest, gaps filled with
   * zeros) — drives the Today screen's week strip. `active` = ≥1 item done.
   */
  async history(
    userId: string,
    days = 7,
    tz?: string,
  ): Promise<
    {
      date: string;
      completed: number;
      total: number;
      active: boolean;
      mood: number | null;
    }[]
  > {
    const span = Math.min(Math.max(days, 1), 31);
    const dayMs = 86_400_000;
    const todayStart = new Date(`${this.today(tz)}T00:00:00.000Z`).getTime();
    const fromStr = new Date(todayStart - (span - 1) * dayMs)
      .toISOString()
      .slice(0, 10);

    const plans = await this.model
      .find(
        { user: new Types.ObjectId(userId), date: { $gte: fromStr } },
        { date: 1, items: 1, mood: 1 },
      )
      .exec();

    const byDate = new Map(plans.map((p) => [p.date, p]));
    const out: {
      date: string;
      completed: number;
      total: number;
      active: boolean;
      mood: number | null;
    }[] = [];
    for (let i = span - 1; i >= 0; i--) {
      const date = new Date(todayStart - i * dayMs).toISOString().slice(0, 10);
      const p = byDate.get(date);
      const completed = p ? p.items.filter((it) => it.done).length : 0;
      out.push({
        date,
        completed,
        total: p ? p.items.length : 0,
        active: completed > 0,
        mood: p?.mood ?? null,
      });
    }
    return out;
  }

  quickMode(userId: string, tz?: string): Promise<DailyPlanDocument> {
    return this.generate(userId, 'quick', tz);
  }

  private trimToBudget(items: DailyItem[], minutes: number): DailyItem[] {
    const out: DailyItem[] = [];
    let total = 0;
    for (const it of items) {
      if (total + it.estimateMinutes > minutes && out.length) break;
      out.push(it);
      total += it.estimateMinutes;
    }
    return out.length ? out : items.slice(0, 1);
  }

  private async persist(
    userId: string,
    date: string,
    mode: DailyPlanMode,
    items: DailyItem[],
  ): Promise<DailyPlanDocument> {
    const totalMinutes = items.reduce((s, i) => s + i.estimateMinutes, 0);
    return this.model
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId), date },
        {
          $set: { mode, items, totalMinutes },
          $setOnInsert: { user: new Types.ObjectId(userId), date },
        },
        { upsert: true, new: true },
      )
      .exec();
  }
}
