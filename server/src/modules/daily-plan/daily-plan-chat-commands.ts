import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChatCommandRegistryService,
  ChatCommandResult,
} from '../agents/core/chat-command-registry.service';
import { DailyPlanService } from './daily-plan.service';
import { DailyPlanDocument } from './schemas/daily-plan.schema';

/**
 * Daily-plan chat commands:
 *   "check off revise recursion"                → really toggles the item
 *   "mark 'quiz: arrays' as done on my plan"    → same, explicit form
 *   "add 20 min of system design to my plan"    → really appends an item
 * Patterns deliberately require "check off" / "…on my plan" so they never
 * collide with the roadmap's "mark X as complete" commands.
 */
@Injectable()
export class DailyPlanChatCommands implements OnModuleInit {
  constructor(
    private readonly registry: ChatCommandRegistryService,
    private readonly plans: DailyPlanService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'daily_plan.check_off',
      description: "Check off an item on today's plan",
      examples: [
        "check off 'revise recursion'",
        "mark 'revise recursion' as done on my plan",
      ],
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /(?:check|tick)\s+off\s+(?:the\s+)?['"“]?(.{2,80}?)['"”]?\s*$/i.exec(
              m.trim(),
            ) ??
            /mark\s+['"“]?(.{2,80}?)['"”]?\s+(?:as\s+)?done\s+(?:from|on|in)\s+(?:my\s+|the\s+|today'?s\s+)?plan\s*$/i.exec(
              m.trim(),
            );
          return r ? { target: r[1].trim() } : null;
        }),
      execute: (userId, p) => this.checkOff(userId, p.target as string),
    });

    this.registry.register({
      name: 'daily_plan.add_item',
      description: "Add an item to today's plan",
      examples: ['add 30 min of system design to my plan'],
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /add\s+(?:(\d{1,3})\s*min(?:ute)?s?\s+of\s+)?['"“]?(.{3,80}?)['"”]?\s+to\s+(?:my\s+|the\s+|today'?s\s+)?plan(?:\s+(?:for\s+)?today)?\s*$/i.exec(
              m.trim(),
            );
          if (!r) return null;
          return {
            title: r[2].trim(),
            minutes: r[1] ? Number(r[1]) : undefined,
          };
        }),
      execute: (userId, p) =>
        this.addItem(
          userId,
          p.title as string,
          p.minutes as number | undefined,
        ),
    });
  }

  private async checkOff(
    userId: string,
    target: string,
  ): Promise<ChatCommandResult> {
    const plan = await this.plans.getToday(userId);
    const item = this.resolveItem(plan, target);
    if (!item) {
      return {
        ok: false,
        summary: `Nothing on today's plan matches "${target}" — nothing was changed.`,
        route: '/app/today',
        routeLabel: 'Open Today',
      };
    }
    const updated = await this.plans.completeItem(userId, item.id);
    const after = updated.items.find((i) => i.id === item.id);
    const done = updated.items.filter((i) => i.done).length;
    return {
      ok: true,
      summary: after?.done
        ? `Checked off "${item.title}" — ${done}/${updated.items.length} done today.`
        : `Unchecked "${item.title}" — it's back on your plate (${done}/${updated.items.length} done).`,
      route: '/app/today',
      routeLabel: 'Open Today',
      // completeItem toggles, so the same command is its own inverse.
      undo: { text: `check off ${item.title}` },
    };
  }

  private async addItem(
    userId: string,
    title: string,
    minutes?: number,
  ): Promise<ChatCommandResult> {
    const updated = await this.plans.addItem(userId, title, minutes ?? 20);
    const added = updated.items[updated.items.length - 1];
    return {
      ok: true,
      summary: `Added "${added.title}" (~${added.estimateMinutes}m) to today's plan — now ${updated.items.length} items, ${updated.totalMinutes} min total.`,
      route: '/app/today',
      routeLabel: 'Open Today',
    };
  }

  /** Best lexical match over today's item titles. */
  private resolveItem(
    plan: DailyPlanDocument,
    target: string,
  ): { id: string; title: string } | null {
    const terms = this.tokens(target);
    if (!terms.length) return null;
    let best: { id: string; title: string; score: number } | null = null;
    for (const item of plan.items) {
      const hay = new Set(this.tokens(item.title));
      let score = 0;
      for (const t of terms) if (hay.has(t)) score++;
      if (score > 0 && (!best || score > best.score)) {
        best = { id: item.id, title: item.title, score };
      }
    }
    return best;
  }

  private tokens(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length > 2,
    );
  }

  /** Questions never write. */
  private guarded(
    message: string,
    run: () => Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    const m = message.trim();
    if (!m || m.includes('?')) return null;
    return run();
  }
}
