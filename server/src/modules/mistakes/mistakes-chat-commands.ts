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
