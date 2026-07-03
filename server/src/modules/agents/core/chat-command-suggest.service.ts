import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { ChatCommandRegistryService } from './chat-command-registry.service';

/** Messages that even look like action requests start with one of these. */
const IMPERATIVE =
  /^(mark|check|tick|complete|finish|add|remove|delete|archive|unarchive|restore|reopen|remember|forget|continue|resume|start|begin|open|regenerate|refocus|replan|re-plan|advance|set|update|change|pin|unpin|repair|fix|undo)\b/i;

const SUGGESTION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    suggestion: { type: 'string', maxLength: 160 },
  },
  required: [],
};

/**
 * "Did you mean" for near-miss chat commands. The deterministic matchers are
 * precision-first, so imperative messages with unusual wording can slip past
 * them. When that happens (and ONLY then), this service asks the model to
 * rewrite the message into one of the registered canonical phrasings.
 *
 * Safety model: the rewrite is never executed. It becomes a chip the learner
 * must click (the click sends the exact text back through the same audited
 * matchers), and it is only offered at all when the rewritten text really
 * would match a matcher — so recall improves while precision stays absolute.
 */
@Injectable()
export class ChatCommandSuggestService {
  private readonly logger = new Logger(ChatCommandSuggestService.name);

  constructor(
    private readonly registry: ChatCommandRegistryService,
    private readonly ai: AiService,
  ) {}

  async suggest(userId: string, message: string): Promise<string | null> {
    if (!this.ai.isLive) return null;
    const t = message.trim();
    if (t.length < 8 || t.length > 140 || t.includes('?')) return null;
    if (!IMPERATIVE.test(t)) return null;
    const commands = this.registry.list().filter((c) => c.examples.length);
    if (!commands.length) return null;

    const catalog = commands
      .map(
        (c) =>
          `- ${c.description}. Say exactly like: ${c.examples.map((e) => `"${e}"`).join(' or ')}`,
      )
      .join('\n');
    try {
      const out = await this.ai.generateStructuredOutput<{
        suggestion?: string;
      }>(
        [
          {
            role: 'system',
            content:
              'You map a learner message onto ONE known chat command phrasing.\n' +
              'Known commands and their canonical phrasings:\n' +
              `${catalog}\n\n` +
              'If the message is clearly asking for one of these actions, return JSON ' +
              '{"suggestion": "<the canonical phrasing, with the learner\'s own topic/title/number substituted in>"}.\n' +
              'If it is not clearly one of these actions, return {"suggestion": ""}. ' +
              'Never invent an action that is not in the list.',
          },
          { role: 'user', content: t },
        ],
        SUGGESTION_SCHEMA,
        {
          temperature: 0,
          maxTokens: 120,
          meta: {
            userId,
            agentType: AgentType.Tutor,
            operation: 'chat.command_suggest',
          },
        },
      );
      const suggestion = out?.suggestion?.trim() ?? '';
      if (!suggestion) return null;
      // The suggestion must survive the same deterministic matchers it will be sent to.
      return this.registry.wouldMatch(suggestion) ? suggestion : null;
    } catch (err) {
      this.logger.warn(`command suggest failed: ${(err as Error).message}`);
      return null;
    }
  }
}
