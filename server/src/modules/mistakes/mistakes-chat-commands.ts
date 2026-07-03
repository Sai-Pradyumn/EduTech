import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChatCommandRegistryService,
  ChatCommandResult,
} from '../agents/core/chat-command-registry.service';
import { MistakesService } from './mistakes.service';

/**
 * Review chat commands — "start my review" / "review my mistakes" in any chat
 * opens the spaced-review queue with an honest account of what's due.
 * Questions ("what should I review?") never trigger this — agents answer those.
 */
@Injectable()
export class MistakesChatCommands implements OnModuleInit {
  constructor(
    private readonly registry: ChatCommandRegistryService,
    private readonly mistakes: MistakesService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'mistakes.start_review',
      description: 'Open the spaced-review queue',
      examples: ['start my review', 'review my mistakes'],
      match: (m) => {
        const t = m.trim();
        if (!t || t.includes('?')) return null;
        if (
          /^(how|what|why|when|where|which|can|could|should|would|do|does|is|are|will)\b/i.test(
            t,
          )
        )
          return null;
        return /(?:start|begin|do|run|open)\s+(?:my\s+|a\s+|the\s+)?(?:spaced\s+)?review(?:\s+session)?\b/i.test(
          t,
        ) || /review\s+my\s+mistakes\b/i.test(t)
          ? {}
          : null;
      },
      execute: (userId) => this.startReview(userId),
    });

    this.registry.register({
      name: 'mistakes.repair_weakest',
      description: 'Start a repair session on the biggest open gap',
      examples: ['repair my weakest area', 'fix my biggest gap'],
      match: (m) => {
        const t = m.trim();
        if (!t || t.includes('?')) return null;
        if (
          /^(how|what|why|when|where|which|can|could|should|would|do|does|is|are|will)\b/i.test(
            t,
          )
        )
          return null;
        return /^(?:repair|fix)\s+my\s+(?:weakest\s+(?:area|concept|skill|topic)|biggest\s+(?:gap|weakness|mistake)|worst\s+(?:area|concept|topic))\b/i.test(
          t,
        )
          ? {}
          : null;
      },
      execute: (userId) => this.repairWeakest(userId),
    });
  }

  private async repairWeakest(userId: string): Promise<ChatCommandResult> {
    const open = await this.mistakes.list(userId, 'open');
    if (open.length === 0) {
      return {
        ok: true,
        summary: 'No open gaps to repair — your slate is clean. 💪',
        route: '/app/mistakes',
        routeLabel: 'Open Mistake OS',
      };
    }
    const worst = open[0];
    return {
      ok: true,
      summary:
        `Your biggest open gap is "${worst.concept}" (severity ${worst.severity}/100, seen ${worst.frequency}×). ` +
        'Opening a repair session with the tutor on exactly that.',
      route: `/app/tutor?topic=${encodeURIComponent(worst.concept)}&mode=explain`,
      routeLabel: `Repair "${worst.concept}"`,
    };
  }

  private async startReview(userId: string): Promise<ChatCommandResult> {
    const due = await this.mistakes.due(userId);
    if (due.length === 0) {
      return {
        ok: true,
        summary:
          'Your spaced-review queue is clear — nothing is due right now. 🎉',
        route: '/app/mistakes',
        routeLabel: 'Open Mistake OS',
      };
    }
    const hardest = due[0];
    return {
      ok: true,
      summary:
        `You have ${due.length} concept${due.length === 1 ? '' : 's'} due for review — ` +
        `hardest first: "${hardest.concept}" (severity ${hardest.severity}/100).`,
      route: '/app/mistakes?filter=due',
      routeLabel: 'Start review',
    };
  }
}
