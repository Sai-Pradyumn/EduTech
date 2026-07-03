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
      name: 'mistakes.log',
      description: 'Log a concept you keep getting wrong',
      examples: [
        'I keep getting recursion wrong',
        'log a mistake: async/await',
      ],
      match: (m) => {
        const t = m.trim();
        if (!t || t.includes('?')) return null;
        const r =
          /(?:i\s+)?(?:keep|always|often|constantly)\s+(?:getting|get)\s+(.{2,60}?)\s+wrong\b/i.exec(
            t,
          ) ??
          /(?:i\s+)?(?:keep|always)\s+(?:messing\s+up|failing\s+at)\s+(.{2,60})/i.exec(
            t,
          ) ??
          /(?:i(?:'m| am)?\s+)?struggl(?:e|ing)\s+with\s+(.{2,60})/i.exec(t) ??
          /log\s+(?:a\s+)?mistake(?:\s+for|:)?\s+(.{2,60})/i.exec(t) ??
          /track\s+(.{2,60}?)\s+as\s+(?:a\s+)?(?:weak\s+area|weakness|gap|mistake)/i.exec(
            t,
          );
        return r ? { concept: r[1].trim() } : null;
      },
      execute: (userId, p) => this.logMistake(userId, p.concept as string),
    });

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

  /** Log a concept the learner keeps getting wrong as a real, reviewable mistake. */
  private async logMistake(
    userId: string,
    concept: string,
  ): Promise<ChatCommandResult> {
    const clean = concept
      .trim()
      .replace(/[.!,;:]+$/, '')
      .replace(/^(?:the|understanding|doing|with)\s+/i, '')
      .trim()
      .slice(0, 80);
    if (clean.length < 2) {
      return {
        ok: false,
        summary:
          'I couldn\'t tell which concept to log — try "I keep getting recursion wrong".',
      };
    }
    const mistake = await this.mistakes.captureManual(userId, {
      concept: clean,
    });
    return {
      ok: true,
      summary: `Logged "${mistake.concept}" as a weak area (severity ${mistake.severity}/100). It'll surface in your spaced-review queue — recall it a few times and it fades.`,
      route: '/app/mistakes',
      routeLabel: 'Open Mistake OS',
    };
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
