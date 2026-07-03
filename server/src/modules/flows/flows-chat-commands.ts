import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChatCommandRegistryService,
  ChatCommandResult,
} from '../agents/core/chat-command-registry.service';
import { FlowsService } from './flows.service';
import { FlowDocument, FlowNode } from './schemas/flow.schema';

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'my',
  'in',
  'on',
  'of',
  'to',
  'and',
  'node',
  'step',
  'flow',
]);

/**
 * Flow chat commands — "mark 'closures' complete in my flow" / "reopen the
 * recursion step in my flow" really update the active flow graph. Every
 * matcher requires the word "flow", so these can never collide with the
 * roadmap topic-mark or daily-plan check-off commands; questions never write.
 */
@Injectable()
export class FlowsChatCommands implements OnModuleInit {
  constructor(
    private readonly registry: ChatCommandRegistryService,
    private readonly flows: FlowsService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'flows.create',
      description: 'Create a new learning flow for a topic',
      examples: [
        'create a flow for system design',
        'make me a learning flow on react',
      ],
      match: (m) => this.matchCreate(m),
      execute: (userId, p) => this.createFlow(userId, String(p['goal'])),
    });
    this.registry.register({
      name: 'flows.complete_node',
      description: 'Mark a step in the active learning flow complete',
      examples: [
        "mark 'closures' complete in my flow",
        'complete the recursion step in my flow',
      ],
      match: (m) => this.matchComplete(m),
      execute: (userId, p) => this.setNode(userId, String(p['title']), true),
    });
    this.registry.register({
      name: 'flows.reopen_node',
      description: 'Reopen a completed step in the active learning flow',
      examples: ["reopen 'closures' in my flow"],
      match: (m) => this.matchReopen(m),
      execute: (userId, p) => this.setNode(userId, String(p['title']), false),
    });
  }

  // ── matchers (precision-first: unambiguous phrasings only) ──

  private guard(message: string): string | null {
    const t = message.trim();
    if (!t || t.includes('?')) return null;
    if (
      /^(how|what|why|when|where|which|can|could|should|would|do|does|is|are|will)\b/i.test(
        t,
      )
    )
      return null;
    return t;
  }

  private matchComplete(message: string): Record<string, unknown> | null {
    const t = this.guard(message);
    if (!t) return null;
    const patterns = [
      /^(?:mark|set)\s+(?:the\s+)?['"“]?(.{2,80}?)['"”]?\s+(?:node\s+|step\s+)?(?:as\s+)?(?:complete|completed|done)\s+in\s+my\s+flow\b/i,
      /^(?:complete|finish)\s+(?:the\s+)?['"“]?(.{2,80}?)['"”]?\s+(?:node|step)\s+in\s+my\s+flow\b/i,
    ];
    for (const rx of patterns) {
      const m = rx.exec(t);
      if (m) return { title: m[1].trim() };
    }
    return null;
  }

  private matchCreate(message: string): Record<string, unknown> | null {
    const t = this.guard(message);
    if (!t) return null;
    const m =
      /^(?:create|generate|make|build|design)\s+(?:me\s+)?(?:a\s+|an\s+|my\s+)?(?:new\s+)?(?:learning\s+)?flow\s+(?:for|on|about|to\s+(?:learn|master))\s+(.{3,160})/i.exec(
        t,
      );
    return m ? { goal: m[1].trim() } : null;
  }

  private matchReopen(message: string): Record<string, unknown> | null {
    const t = this.guard(message);
    if (!t) return null;
    const m =
      /^reopen\s+(?:the\s+)?['"“]?(.{2,80}?)['"”]?\s+(?:node\s+|step\s+)?in\s+my\s+flow\b/i.exec(
        t,
      );
    return m ? { title: m[1].trim() } : null;
  }

  // ── execution ──

  /** Create a real learning flow from a chat request via the generation pipeline. */
  private async createFlow(
    userId: string,
    goal: string,
  ): Promise<ChatCommandResult> {
    const clean = goal
      .replace(/[.!?]+$/, '')
      .trim()
      .slice(0, 160);
    if (clean.length < 3) {
      return {
        ok: false,
        summary:
          'I couldn\'t tell what the flow should cover — try "create a flow for system design".',
      };
    }
    const flow = await this.flows.generate(userId, { goal: clean });
    return {
      ok: true,
      summary: `Created a new learning flow — "${flow.title}" (${flow.nodes.length} steps). It's ready in Flow Studio.`,
      route: `/app/flows/${String(flow._id)}`,
      routeLabel: 'Open the flow',
    };
  }

  private async setNode(
    userId: string,
    phrase: string,
    complete: boolean,
  ): Promise<ChatCommandResult> {
    const flow = await this.flows.findActive(userId);
    if (!flow) {
      return {
        ok: false,
        summary:
          "You don't have an active flow yet — generate one in Flow Studio first.",
        route: '/app/flows',
        routeLabel: 'Open Flow Studio',
      };
    }
    const node = this.resolveNode(flow, phrase);
    const flowRoute = `/app/flows/${String(flow._id)}`;
    if (!node) {
      return {
        ok: false,
        summary: `I couldn't find a step matching “${phrase}” in your flow "${flow.title}" — nothing was changed.`,
        route: flowRoute,
        routeLabel: 'Open the flow',
      };
    }
    if (complete && node.status === 'completed') {
      return {
        ok: true,
        summary: `“${node.title}” is already complete in "${flow.title}" — nothing to change.`,
        route: flowRoute,
        routeLabel: 'Open the flow',
      };
    }
    if (!complete && node.status !== 'completed') {
      return {
        ok: true,
        summary: `“${node.title}” isn't marked complete in "${flow.title}" — nothing to reopen.`,
        route: flowRoute,
        routeLabel: 'Open the flow',
      };
    }

    const saved = await this.flows.updateNode(
      userId,
      String(flow._id),
      node.id,
      { status: complete ? 'completed' : 'available' },
    );
    const unlocked = complete
      ? saved.nodes.filter(
          (n) => n.status === 'available' && n.prerequisites.includes(node.id),
        )
      : [];
    return {
      ok: true,
      summary: complete
        ? `Marked “${node.title}” complete in your flow "${flow.title}" — ${saved.progressPercentage}% done` +
          (unlocked.length
            ? `, unlocking ${unlocked.map((n) => `“${n.title}”`).join(', ')}.`
            : '.')
        : `Reopened “${node.title}” in your flow "${flow.title}" — back to ${saved.progressPercentage}% done.`,
      route: flowRoute,
      routeLabel: 'Open the flow',
      undo: {
        text: complete
          ? `reopen '${node.title}' in my flow`
          : `mark '${node.title}' complete in my flow`,
      },
    };
  }

  /** Direct substring match first; otherwise ≥ half the significant tokens must appear. */
  private resolveNode(flow: FlowDocument, phrase: string): FlowNode | null {
    const norm = (s: string): string =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const p = norm(phrase);
    if (!p) return null;
    const direct = flow.nodes
      .filter((n) => norm(n.title).includes(p))
      .sort((a, b) => a.title.length - b.title.length);
    if (direct.length) return direct[0];

    const qTokens = p
      .split(' ')
      .filter((t) => t.length > 1 && !STOPWORDS.has(t));
    if (!qTokens.length) return null;
    let best: FlowNode | null = null;
    let bestScore = 0;
    for (const n of flow.nodes) {
      const tTokens = new Set(norm(`${n.title} ${n.summary}`).split(' '));
      const score = qTokens.filter((t) => tTokens.has(t)).length;
      if (score > bestScore) {
        best = n;
        bestScore = score;
      }
    }
    return bestScore >= Math.max(1, Math.ceil(qTokens.length / 2))
      ? best
      : null;
  }
}
