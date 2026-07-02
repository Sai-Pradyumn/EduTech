import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChatCommandRegistryService,
  ChatCommandResult,
} from '../agents/core/chat-command-registry.service';
import { RoadmapService } from './roadmap.service';
import { RoadmapDocument, WeekPlan } from './schemas/roadmap.schema';

/**
 * Roadmap chat commands — saying it in ANY chat really updates the roadmap:
 *   "mark week 2 as complete" / "mark the fundamentals as completed"
 *   "I've already mastered recursion" · "move me to the next week/flow"
 *   "reopen week 2" · "change week 3 to focus on system design"
 *   "modify my roadmap to focus on interviews" · "restore my roadmap to version 2"
 *
 * Matching is deterministic and precision-first: a missed phrasing costs one
 * click in the UI, a wrong write costs the learner's trust. Questions
 * (anything containing "?" or starting with a question word) never trigger
 * writes — those belong to the agents.
 */
@Injectable()
export class RoadmapChatCommands implements OnModuleInit {
  constructor(
    private readonly registry: ChatCommandRegistryService,
    private readonly roadmaps: RoadmapService,
  ) {}

  onModuleInit(): void {
    // Registration order = match priority (most explicit first).
    this.registry.register({
      name: 'roadmap.restore_version',
      description: 'Restore the roadmap to an earlier version',
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /(?:restore|revert|roll\s*back)(?:\s+\S+){0,6}?\s+(?:to\s+)?(?:version|v)\s*(\d+)/i.exec(
              m,
            );
          return r ? { version: Number(r[1]) } : null;
        }),
      execute: (userId, p) => this.restore(userId, p.version as number),
    });

    this.registry.register({
      name: 'roadmap.mark_week_complete',
      description: 'Mark a roadmap week as complete',
      match: (m) =>
        this.guarded(m, () => {
          const byNumber =
            /(?:mark|set)\s+(?:the\s+)?week\s+(\d+)\s+(?:as\s+)?(?:complete(?:d)?|done|finished|mastered)/i.exec(
              m,
            ) ??
            /(?:i(?:'ve| have)?\s+)?(?:already\s+)?(?:completed|finished|mastered)\s+week\s+(\d+)/i.exec(
              m,
            ) ??
            /week\s+(\d+)\s+is\s+(?:complete(?:d)?|done|finished)/i.exec(m);
          return byNumber ? { weekNumber: Number(byNumber[1]) } : null;
        }),
      execute: (userId, p) =>
        this.complete(userId, { weekNumber: p.weekNumber as number }),
    });

    this.registry.register({
      name: 'roadmap.reopen_week',
      description: 'Reopen a completed roadmap week',
      match: (m) =>
        this.guarded(m, () => {
          const r = /(?:unmark|reopen|un-?complete)\s+week\s+(\d+)/i.exec(m);
          return r ? { weekNumber: Number(r[1]) } : null;
        }),
      execute: (userId, p) => this.reopen(userId, p.weekNumber as number),
    });

    this.registry.register({
      name: 'roadmap.refocus_week',
      description: 'Rework a roadmap week around a new focus',
      match: (m) =>
        this.guarded(m, () => {
          const byWeek =
            /(?:change|modify|update|adjust|refocus|rework)\s+(?:my\s+)?week\s+(\d+)\s+to\s+(?:focus\s+(?:more\s+)?on\s+|cover\s+|be\s+about\s+)?(.{3,120})/i.exec(
              m,
            ) ??
            /regenerate\s+week\s+(\d+)\s+(?:with|around|focusing\s+on)\s+(.{3,120})/i.exec(
              m,
            );
          if (byWeek) {
            return {
              weekNumber: Number(byWeek[1]),
              note: this.cleanNote(byWeek[2]),
            };
          }
          const wholeRoadmap =
            /(?:change|modify|update|adjust|refocus)\s+(?:my\s+|the\s+)?roadmap\s+(?:to\s+focus\s+(?:more\s+)?on|according\s+to|to\s+include|to\s+add|around)\s+(.{3,120})/i.exec(
              m,
            );
          return wholeRoadmap
            ? { note: this.cleanNote(wholeRoadmap[1]) }
            : null;
        }),
      execute: (userId, p) =>
        this.refocus(
          userId,
          p.note as string,
          p.weekNumber as number | undefined,
        ),
    });

    this.registry.register({
      name: 'roadmap.mark_topic_complete',
      description: 'Mark the roadmap week covering a topic as complete',
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /mark\s+(?:the\s+)?(.{2,60}?)\s+(?:as\s+)?(?:complete(?:d)?|done|mastered)/i.exec(
              m,
            ) ??
            /i(?:'ve| have)\s+(?:already\s+)?mastered\s+(?:the\s+)?([^,.!?]{2,60})/i.exec(
              m,
            );
          return r ? { target: r[1].trim() } : null;
        }),
      execute: (userId, p) =>
        this.complete(userId, { target: p.target as string }),
    });

    this.registry.register({
      name: 'roadmap.advance',
      description: 'Complete the current week and move to the next',
      match: (m) =>
        this.guarded(m, () =>
          /(?:move|go|advance|take\s+me|proceed)\s+(?:me\s+)?(?:on\s+)?to\s+(?:the\s+)?next\s+(?:week|flow|step|module|topic|phase)/i.test(
            m,
          )
            ? {}
            : null,
        ),
      execute: (userId) => this.complete(userId, { target: 'current' }),
    });
  }

  // ───────────────────────── executors ─────────────────────────

  private async complete(
    userId: string,
    which: { weekNumber?: number; target?: string },
  ): Promise<ChatCommandResult> {
    const roadmap = await this.roadmaps.findActive(userId);
    if (!roadmap) return this.noRoadmap();
    const week = this.resolveWeek(roadmap, which);
    if (!week) {
      return {
        ok: false,
        summary: which.target
          ? `I couldn't find a week on your roadmap matching "${which.target}" — nothing was changed. Try "mark week 3 as complete".`
          : `Week ${which.weekNumber} isn't on your roadmap — nothing was changed.`,
        route: this.route(roadmap),
        routeLabel: 'Open roadmap',
      };
    }
    if (roadmap.completedWeeks.includes(week.weekNumber)) {
      return {
        ok: true,
        summary: `Week ${week.weekNumber} — "${week.focus}" — was already complete. ${this.nextUp(roadmap, week.weekNumber)}`,
        route: this.route(roadmap),
        routeLabel: 'Open roadmap',
      };
    }
    const updated = await this.roadmaps.updateProgress(
      userId,
      roadmap.id as string,
      { weekNumber: week.weekNumber, weekCompleted: true },
    );
    return {
      ok: true,
      summary:
        `Marked Week ${week.weekNumber} — "${week.focus}" — complete on "${updated.title}". ` +
        `Progress: ${updated.progressPercentage}%. ${this.nextUp(updated)}`,
      route: this.route(updated),
      routeLabel: 'Open roadmap',
    };
  }

  private async reopen(
    userId: string,
    weekNumber: number,
  ): Promise<ChatCommandResult> {
    const roadmap = await this.roadmaps.findActive(userId);
    if (!roadmap) return this.noRoadmap();
    if (!roadmap.weeklyPlan.some((w) => w.weekNumber === weekNumber)) {
      return {
        ok: false,
        summary: `Week ${weekNumber} isn't on your roadmap — nothing was changed.`,
      };
    }
    const updated = await this.roadmaps.updateProgress(
      userId,
      roadmap.id as string,
      { weekNumber, weekCompleted: false },
    );
    return {
      ok: true,
      summary: `Reopened Week ${weekNumber} — it's back on your plan. Progress: ${updated.progressPercentage}%.`,
      route: this.route(updated),
      routeLabel: 'Open roadmap',
    };
  }

  private async refocus(
    userId: string,
    note: string,
    weekNumber?: number,
  ): Promise<ChatCommandResult> {
    const roadmap = await this.roadmaps.findActive(userId);
    if (!roadmap) return this.noRoadmap();
    const week =
      weekNumber !== undefined
        ? roadmap.weeklyPlan.find((w) => w.weekNumber === weekNumber)
        : this.currentWeek(roadmap);
    if (!week) {
      return {
        ok: false,
        summary:
          weekNumber !== undefined
            ? `Week ${weekNumber} isn't on your roadmap — nothing was changed.`
            : 'Every week is already complete, so there is no current week to rework.',
      };
    }
    const updated = await this.roadmaps.regenerateWeek(
      userId,
      roadmap.id as string,
      week.weekNumber,
      note,
    );
    const reworked = updated.weeklyPlan.find(
      (w) => w.weekNumber === week.weekNumber,
    );
    return {
      ok: true,
      summary:
        `Reworked Week ${week.weekNumber} around "${note}" — it's now "${reworked?.focus ?? note}" ` +
        `and its tasks were reset for the new plan. Saved as a new version, so you can restore the old week any time.`,
      route: this.route(updated),
      routeLabel: 'See the new week',
    };
  }

  private async restore(
    userId: string,
    version: number,
  ): Promise<ChatCommandResult> {
    const roadmap = await this.roadmaps.findActive(userId);
    if (!roadmap) return this.noRoadmap();
    try {
      const restored = await this.roadmaps.restoreVersion(
        userId,
        roadmap.id as string,
        version,
      );
      return {
        ok: true,
        summary:
          `Restored "${restored.title}" to version ${version} — ${restored.weeklyPlan.length} weeks. ` +
          `Completed progress was kept where it still applies (${restored.progressPercentage}%).`,
        route: this.route(restored),
        routeLabel: 'Open roadmap',
      };
    } catch {
      return {
        ok: false,
        summary: `Version ${version} doesn't exist for your roadmap — nothing was changed. Open the roadmap's history to see available versions.`,
        route: this.route(roadmap),
        routeLabel: 'Open history',
      };
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Questions never trigger writes; short-circuit before any pattern runs. */
  private guarded(
    message: string,
    run: () => Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    const m = message.trim();
    if (!m || m.includes('?')) return null;
    if (
      /^(how|what|why|when|where|which|can|could|should|would|do|does|is|are|will)\b/i.test(
        m,
      )
    )
      return null;
    return run();
  }

  private cleanNote(raw: string): string {
    return raw
      .trim()
      .replace(/[.!,;:]+$/, '')
      .slice(0, 120);
  }

  /** First not-yet-completed week — the learner's "current" week. */
  private currentWeek(roadmap: RoadmapDocument): WeekPlan | undefined {
    return roadmap.weeklyPlan.find(
      (w) => !roadmap.completedWeeks.includes(w.weekNumber),
    );
  }

  /**
   * Resolve "the fundamentals" / "it" / week 3 to an actual week: exact number,
   * current-week pronouns, else best lexical overlap against title+focus+topics.
   */
  private resolveWeek(
    roadmap: RoadmapDocument,
    which: { weekNumber?: number; target?: string },
  ): WeekPlan | undefined {
    if (which.weekNumber !== undefined) {
      return roadmap.weeklyPlan.find((w) => w.weekNumber === which.weekNumber);
    }
    const target = (which.target ?? '').toLowerCase().trim();
    if (!target) return undefined;
    if (
      /^(it|this|this\s+week|the\s+current\s+week|current(\s+week)?)$/.test(
        target,
      )
    ) {
      return this.currentWeek(roadmap);
    }
    const targetTokens = this.tokens(target);
    if (targetTokens.length === 0) return this.currentWeek(roadmap);

    let best: { week: WeekPlan; score: number } | null = null;
    for (const week of roadmap.weeklyPlan) {
      const hay = new Set(
        this.tokens(
          `${week.title} ${week.focus} ${(week.topics ?? []).join(' ')}`,
        ),
      );
      let score = 0;
      for (const t of targetTokens) if (hay.has(t)) score++;
      if (score === 0) continue;
      const better =
        !best ||
        score > best.score ||
        // Tie → prefer the not-yet-completed (earlier) week.
        (score === best.score &&
          !roadmap.completedWeeks.includes(week.weekNumber) &&
          roadmap.completedWeeks.includes(best.week.weekNumber));
      if (better) best = { week, score };
    }
    return best?.week;
  }

  private tokens(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length > 2 && !['the', 'and', 'for', 'with'].includes(t),
    );
  }

  private nextUp(roadmap: RoadmapDocument, justCompleted?: number): string {
    const next = roadmap.weeklyPlan.find(
      (w) =>
        !roadmap.completedWeeks.includes(w.weekNumber) &&
        w.weekNumber !== justCompleted,
    );
    return next
      ? `Next up: Week ${next.weekNumber} — "${next.focus}".`
      : 'That was the last open week — the roadmap is complete! 🎉';
  }

  private route(roadmap: RoadmapDocument): string {
    return `/app/roadmap/${roadmap.id as string}`;
  }

  private noRoadmap(): ChatCommandResult {
    return {
      ok: false,
      summary:
        "You don't have an active roadmap yet, so there was nothing to update. Generate one first and I can manage it from chat.",
      route: '/app/roadmap/generate',
      routeLabel: 'Generate a roadmap',
    };
  }
}
