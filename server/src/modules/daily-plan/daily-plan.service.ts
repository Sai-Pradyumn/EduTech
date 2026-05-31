import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoadmapStatus } from '../../common/enums';
import { FlowsService } from '../flows/flows.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import { DailyItem, DailyPlan, DailyPlanDocument, DailyPlanMode } from './schemas/daily-plan.schema';

@Injectable()
export class DailyPlanService {
  constructor(
    @InjectModel(DailyPlan.name) private readonly model: Model<DailyPlanDocument>,
    @InjectModel(Roadmap.name) private readonly roadmaps: Model<RoadmapDocument>,
    private readonly flows: FlowsService,
    private readonly mistakes: MistakesService,
  ) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async getToday(userId: string): Promise<DailyPlanDocument> {
    const date = this.today();
    const existing = await this.model.findOne({ user: new Types.ObjectId(userId), date }).exec();
    return existing ?? this.generate(userId, 'normal');
  }

  /** Build today's plan from the active flow, open mistakes, the roadmap and a quiz nudge. */
  async generate(userId: string, mode: DailyPlanMode): Promise<DailyPlanDocument> {
    const date = this.today();
    const prev = await this.model.findOne({ user: new Types.ObjectId(userId), date }).exec();
    const doneKeys = new Set((prev?.items ?? []).filter((i) => i.done).map((i) => i.sourceId ?? i.title));

    const [activeFlow, openMistakes, roadmap] = await Promise.all([
      this.flows.findActive(userId),
      this.mistakes.list(userId, 'open'),
      this.roadmaps.findOne({ user: new Types.ObjectId(userId), status: RoadmapStatus.Active }).sort({ updatedAt: -1 }).exec(),
    ]);

    const items: DailyItem[] = [];
    const add = (it: Omit<DailyItem, 'done'>) => items.push({ ...it, done: doneKeys.has(it.sourceId ?? it.title) });

    if (mode === 'burnout_recovery') {
      add({ id: 'i_rev', kind: 'revision', title: 'Gentle 10-min revision of something you already know', reason: 'Burnout recovery — rebuild momentum without pressure.', route: '/app/tutor', estimateMinutes: 10 });
      return this.persist(userId, date, mode, items);
    }

    if (mode === 'exam') {
      add({ id: 'i_quiz', kind: 'quiz', title: 'Timed practice quiz', reason: 'Exam tomorrow — simulate test conditions.', route: '/app/quizzes', estimateMinutes: 25 });
      openMistakes.slice(0, 2).forEach((m, i) => add({ id: `i_m${i}`, kind: 'mistake', title: `Cram-repair: ${m.concept}`, reason: `Open gap at severity ${m.severity}.`, route: '/app/mistakes', estimateMinutes: 15, sourceId: String(m._id) }));
      add({ id: 'i_sim', kind: 'revision', title: 'One viva simulation on your weakest topic', reason: 'Active recall under pressure beats re-reading.', route: '/app/simulations', estimateMinutes: 15 });
      return this.persist(userId, date, mode, items);
    }

    // normal + quick share the same candidate pool; quick trims to ~20 min.
    const nextNode = activeFlow?.nodes.find((n) => n.status === 'available' || n.status === 'in_progress');
    if (nextNode && activeFlow) {
      add({ id: 'i_flow', kind: 'flow_node', title: nextNode.title, reason: `Next step in "${activeFlow.title}".`, route: `/app/flows/${String(activeFlow._id)}`, estimateMinutes: nextNode.estimatedMinutes || 30, sourceId: nextNode.id });
    }
    if (openMistakes[0]) {
      const m = openMistakes[0];
      add({ id: 'i_mistake', kind: 'mistake', title: `Repair: ${m.concept}`, reason: `Highest open gap (severity ${m.severity}).`, route: '/app/mistakes', estimateMinutes: 20, sourceId: String(m._id) });
    }
    if (roadmap) {
      const week = roadmap.weeklyPlan.find((w) => !roadmap.completedWeeks.includes(w.weekNumber));
      if (week) add({ id: 'i_road', kind: 'revision', title: `Roadmap · ${week.focus}`, reason: `Week ${week.weekNumber} of "${roadmap.title}".`, route: `/app/roadmap/${String(roadmap._id)}`, estimateMinutes: 30, sourceId: `week-${week.weekNumber}` });
    }
    add({ id: 'i_quiz', kind: 'quiz', title: 'Quick mastery check', reason: 'Lock in what you studied with a short quiz.', route: '/app/quizzes', estimateMinutes: 15 });

    const trimmed = mode === 'quick' ? this.trimToBudget(items, 20) : items.slice(0, 5);
    return this.persist(userId, date, mode, trimmed);
  }

  async completeItem(userId: string, itemId: string): Promise<DailyPlanDocument> {
    const plan = await this.getToday(userId);
    const item = plan.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Plan item not found');
    item.done = !item.done;
    plan.markModified('items');
    return plan.save();
  }

  recalculate(userId: string): Promise<DailyPlanDocument> {
    return this.generate(userId, 'normal');
  }

  quickMode(userId: string): Promise<DailyPlanDocument> {
    return this.generate(userId, 'quick');
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

  private async persist(userId: string, date: string, mode: DailyPlanMode, items: DailyItem[]): Promise<DailyPlanDocument> {
    const totalMinutes = items.reduce((s, i) => s + i.estimateMinutes, 0);
    return this.model
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId), date },
        { $set: { mode, items, totalMinutes }, $setOnInsert: { user: new Types.ObjectId(userId), date } },
        { upsert: true, new: true },
      )
      .exec();
  }
}
