import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { AgentToolRegistryService } from './agent-tool-registry.service';
import { AgentRuntimeContext } from './agent.interface';

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    tool: { type: 'string', description: 'tool name to call, or "none"' },
    query: { type: 'string', description: 'search query if the tool needs one' },
  },
  required: ['tool'],
} as const;

// Only spend a tool-selection call when the message plausibly needs live data.
const HINT = /\b(my notes|my doc|my pdf|uploaded|my progress|my mastery|how am i doing|my weak|according to my)\b/i;

/**
 * The actor→critic→execute loop (read-only): when a live LLM is configured and the message
 * references the student's own materials/progress, the model picks ONE registered tool; the
 * registry's static critic validates + runs it (userId injected server-side); the result is
 * returned as a grounding note the agent prepends to its prompt. Bounded to one round, and
 * gated by a hint so normal turns pay no extra latency.
 */
@Injectable()
export class ToolAugmentationService {
  private readonly logger = new Logger(ToolAugmentationService.name);

  constructor(
    private readonly ai: AiService,
    private readonly tools: AgentToolRegistryService,
  ) {}

  async augment(ctx: AgentRuntimeContext): Promise<string | null> {
    if (!this.ai.isLive || !HINT.test(ctx.request.message)) return null;
    const available = this.tools.list().filter((t) => t.readOnly);
    if (!available.length) return null;

    try {
      const choice = await this.ai.generateStructuredOutput<{ tool: string; query?: string }>(
        [
          {
            role: 'system',
            content:
              'Decide if a tool would help answer the student. Tools (read-only):\n' +
              available.map((t) => `- ${t.name}: ${t.description}`).join('\n') +
              '\nReturn {"tool":"<name>"|"none","query":"..."}. Use "none" if no tool helps.',
          },
          { role: 'user', content: ctx.request.message },
        ],
        TOOL_SCHEMA as unknown as Record<string, unknown>,
        { temperature: 0 },
      );

      if (!choice?.tool || choice.tool === 'none' || !this.tools.has(choice.tool)) return null;

      // Static critic enforces the allowlist + injects the trusted userId.
      const result = await this.tools.safeCall(
        choice.tool,
        { query: choice.query },
        { userId: ctx.request.userId },
      );
      ctx.emit({ type: 'tool_call', messageId: '', tool: choice.tool, label: `Using ${choice.tool.replace(/_/g, ' ')}` });
      const summary = JSON.stringify(result).slice(0, 1200);
      ctx.emit({ type: 'tool_result', messageId: '', tool: choice.tool, summary: 'Fetched live context' });
      return `TOOL RESULT (${choice.tool}): ${summary}\nUse this real data in your answer; cite the student's sources where relevant.`;
    } catch (err) {
      this.logger.warn(`Tool augmentation skipped: ${(err as Error).message}`);
      return null;
    }
  }
}
