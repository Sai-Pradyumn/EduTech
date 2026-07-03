import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChatCommandRegistryService,
  ChatCommandResult,
} from '../agents/core/chat-command-registry.service';
import { MemoryService } from './memory.service';

/**
 * Memory chat commands — the ChatGPT-style memory contract:
 *   "remember that I prefer video lessons"  → really saved (both stores)
 *   "forget my language preference"         → really deleted, named verbatim
 * Nothing matched → nothing deleted, said plainly. Questions never write.
 */
@Injectable()
export class MemoryChatCommands implements OnModuleInit {
  constructor(
    private readonly registry: ChatCommandRegistryService,
    private readonly memory: MemoryService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'memory.remember',
      description: 'Save a fact to memory',
      examples: ['remember that I prefer video lessons'],
      match: (m) =>
        this.guarded(m, () => {
          const r = /^remember\s+(?:that\s+)?(.{3,300})$/i.exec(m.trim());
          return r ? { text: r[1].trim().replace(/[.!]+$/, '') } : null;
        }),
      execute: (userId, p) => this.remember(userId, p.text as string),
    });

    this.registry.register({
      name: 'memory.forget',
      description: 'Delete a memory',
      examples: ['forget my language preference'],
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /^forget\s+(?:about\s+|what\s+you\s+know\s+about\s+|that\s+)?(.{2,160})$/i.exec(
              m.trim(),
            );
          return r ? { query: r[1].trim().replace(/[.!]+$/, '') } : null;
        }),
      execute: (userId, p) => this.forget(userId, p.query as string),
    });
  }

  private async remember(
    userId: string,
    text: string,
  ): Promise<ChatCommandResult> {
    await this.memory.rememberFact(userId, '', text);
    return {
      ok: true,
      summary: `Saved to memory: "${text}". I'll use it to personalize your learning — you can review or delete it any time.`,
      route: '/app/profile',
      routeLabel: 'Manage memory',
    };
  }

  private async forget(
    userId: string,
    query: string,
  ): Promise<ChatCommandResult> {
    const deleted = await this.memory.forgetMatching(userId, '', query);
    if (!deleted) {
      return {
        ok: false,
        summary: `Nothing in my memory matches "${query}" — nothing was deleted. You can see everything I remember on your profile.`,
        route: '/app/profile',
        routeLabel: 'View memory',
      };
    }
    return {
      ok: true,
      summary: `Forgotten: "${deleted}". It will no longer influence my answers.`,
      route: '/app/profile',
      routeLabel: 'Manage memory',
    };
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
