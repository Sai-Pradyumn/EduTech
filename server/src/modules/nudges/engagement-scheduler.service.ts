import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { MailerService } from '../mailer/mailer.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DailyPlan,
  DailyPlanDocument,
} from '../daily-plan/schemas/daily-plan.schema';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

/** Users considered per scheduled run (most recently updated first). */
const SCAN_LIMIT = 500;
const INACTIVE_AFTER_DAYS = 3;

/**
 * Time-based engagement — the pull the app was missing. Event nudges fire when
 * the learner acts; these fire when they DON'T:
 *  - daily 09:00: inactivity nudge (≥3 days without a completed plan item) and
 *    a due-reviews nudge (spaced reviews waiting).
 *  - Monday 09:00: a weekly digest — honest numbers from real data (items done,
 *    minutes, roadmap progress, top open gap) — in-app always, email when SMTP
 *    is configured (MailerService is dev-safe otherwise).
 * All per-user work is guarded: one learner failing never stops the sweep, and
 * createUnique dedupes so re-runs never spam.
 */
@Injectable()
export class EngagementSchedulerService {
  private readonly logger = new Logger(EngagementSchedulerService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(DailyPlan.name)
    private readonly plans: Model<DailyPlanDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    private readonly mistakes: MistakesService,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
  ) {}

  @Cron('0 9 * * *')
  async dailyScan(): Promise<void> {
    const users = await this.recentUsers();
    let nudged = 0;
    for (const user of users) {
      try {
        nudged += await this.evaluateDaily(String(user._id));
      } catch (err) {
        this.logger.warn(
          `daily scan failed for ${String(user._id)}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Daily engagement scan: ${users.length} users, ${nudged} nudges`,
    );
  }

  @Cron('0 9 * * 1')
  async weeklyDigest(): Promise<void> {
    const users = await this.recentUsers();
    let sent = 0;
    for (const user of users) {
      try {
        const ok = await this.sendDigest(
          String(user._id),
          user.email,
          user.name,
        );
        if (ok) sent++;
      } catch (err) {
        this.logger.warn(
          `digest failed for ${String(user._id)}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`Weekly digest: ${users.length} users, ${sent} digests`);
  }

  // ───────────────────────── per-user logic (testable) ─────────────────────────

  /** Returns how many nudges were raised for this user. */
  async evaluateDaily(userId: string): Promise<number> {
    let raised = 0;

    const lastActive = await this.lastActiveDate(userId);
    if (
      lastActive !== null &&
      this.daysSince(lastActive) >= INACTIVE_AFTER_DAYS
    ) {
      await this.notifications.createUnique(userId, {
        type: 'nudge',
        title: 'Your momentum misses you',
        body: `It's been ${this.daysSince(lastActive)} days since your last completed item. One 10-minute task today restarts the streak.`,
        link: '/app/today',
      });
      raised++;
    }

    const due = await this.mistakes.due(userId);
    if (due.length > 0) {
      await this.notifications.createUnique(userId, {
        type: 'nudge',
        title: `${due.length} concept${due.length === 1 ? '' : 's'} due for review`,
        body: `"${due[0].concept}" is at the top — a 5-minute spaced review now locks it into long-term memory.`,
        link: '/app/mistakes?filter=due',
      });
      raised++;
    }
    return raised;
  }

  /** True when a digest was produced (users with zero signal are skipped, not spammed). */
  async sendDigest(
    userId: string,
    email?: string,
    name?: string,
  ): Promise<boolean> {
    const weekAgo = this.isoDaysAgo(7);
    const [plans, roadmap, openMistakes] = await Promise.all([
      this.plans
        .find({ user: new Types.ObjectId(userId), date: { $gte: weekAgo } })
        .lean()
        .exec(),
      this.roadmaps
        .findOne({ user: new Types.ObjectId(userId), status: 'active' })
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
      this.mistakes.list(userId, 'open'),
    ]);

    const doneItems = plans.flatMap((p) => p.items.filter((i) => i.done));
    const minutes = doneItems.reduce((s, i) => s + (i.estimateMinutes || 0), 0);
    if (doneItems.length === 0 && !roadmap) return false; // nothing to say — say nothing

    const currentWeek = roadmap?.weeklyPlan.find(
      (w) => !roadmap.completedWeeks.includes(w.weekNumber),
    );
    const lines = [
      `${doneItems.length} plan item${doneItems.length === 1 ? '' : 's'} completed (~${minutes} min of focused learning).`,
      ...(roadmap
        ? [
            `Roadmap "${roadmap.title}": ${roadmap.progressPercentage}% done${currentWeek ? ` — this week's focus: ${currentWeek.focus}.` : ' — complete! 🎉'}`,
          ]
        : []),
      ...(openMistakes.length
        ? [
            `${openMistakes.length} open gap${openMistakes.length === 1 ? '' : 's'} — biggest: "${openMistakes[0].concept}".`,
          ]
        : ['No open gaps — clean slate. 💪']),
    ];

    await this.notifications.createUnique(userId, {
      type: 'nudge',
      title: 'Your week in review',
      body: lines.join(' '),
      link: '/app/progress',
    });

    // Email only when SMTP is really configured — never console-spam per user.
    if (email && this.mailer.live) {
      await this.mailer.send(
        email,
        'Your Asta week in review',
        `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#111">Your week, ${name ?? 'learner'}</h2>
          <ul style="color:#444;line-height:1.7">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
          <p style="color:#888;font-size:13px">Open <a href="https://asta.dev/app/today">Today</a> to keep the momentum going.</p>
        </div>`,
        lines.join('\n'),
      );
    }
    return true;
  }

  // ───────────────────────── helpers ─────────────────────────

  private recentUsers(): Promise<UserDocument[]> {
    return this.users.find({}).sort({ updatedAt: -1 }).limit(SCAN_LIMIT).exec();
  }

  /** Date (yyyy-mm-dd) of the most recent day with a completed plan item; null = no history. */
  private async lastActiveDate(userId: string): Promise<string | null> {
    const recent = await this.plans
      .find({ user: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .limit(14)
      .lean()
      .exec();
    if (recent.length === 0) return null; // brand-new users aren't "inactive"
    const active = recent.find((p) => p.items.some((i) => i.done));
    return active?.date ?? recent[recent.length - 1].date;
  }

  private daysSince(isoDate: string): number {
    const then = new Date(`${isoDate}T00:00:00.000Z`).getTime();
    return Math.floor((Date.now() - then) / 86_400_000);
  }

  private isoDaysAgo(days: number): string {
    return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  }
}
