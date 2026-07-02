import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { estimateTokens } from '../../ai/gateway/pricing';
import { AIMessage } from '../../ai/interfaces/ai-provider.interface';
import { AgentRuntimeContext } from './agent.interface';

export interface ComposeOptions {
  /** Agent persona + task instructions (see prompts/personas.ts). */
  system: string;
  /** User turn; defaults to the request message. */
  user?: string;
  /** Deterministic answer to stream when there is no live LLM or a call fails. */
  fallback: string;
  agentType: AgentType;
  operation: string;
  temperature?: number;
}

/**
 * Shared answer composer for agents. When a live LLM is configured it streams a real,
 * profile-grounded answer token-by-token (emitting `chunk` events); otherwise it streams
 * the agent's deterministic fallback. Either way the full answer text is returned so the
 * agent can attach it to its AgentResponse. Visual blocks stay each agent's job.
 */
@Injectable()
export class LlmComposerService {
  private readonly logger = new Logger(LlmComposerService.name);

  constructor(private readonly ai: AiService) {}

  get isLive(): boolean {
    return this.ai.isLive;
  }

  /** Compact, model-friendly summary of who we're talking to. */
  contextBlock(ctx: AgentRuntimeContext): string {
    const p = ctx.profile;
    const lines: string[] = [];
    if (p) {
      lines.push(
        `Student: ${p.fullName?.split(' ')[0] ?? 'there'} · ${p.educationLevel} · ${p.branch}`,
        `Skill level: ${p.currentSkillLevel} · Learning style: ${p.preferredLearningStyle} · Language: ${p.preferredLanguage}`,
        `Goal: ${p.mainGoal} · Career target: ${p.careerTarget}`,
      );
      if (p.currentSkills?.length)
        lines.push(`Known skills: ${p.currentSkills.join(', ')}`);
      if (p.weakAreas?.length)
        lines.push(`Weak areas (go deeper here): ${p.weakAreas.join(', ')}`);
    }
    if (ctx.roadmap) {
      lines.push(
        `Active roadmap: "${ctx.roadmap.title}" (${ctx.roadmap.progressPercentage}% done)` +
          (ctx.roadmap.currentWeekFocus
            ? ` · current focus: ${ctx.roadmap.currentWeekFocus}`
            : ''),
      );
    }
    if (ctx.facts?.length) {
      // Context-engine output: already query-relevant and token-budgeted. Grouped
      // by signal so the model can weigh a struggle differently from a plan item.
      const labels: Record<string, string> = {
        memory: 'Remembered about them',
        mistake: 'Current struggles (address these when relevant)',
        mastery: 'Skill state',
        plan: 'Their plan',
        course: 'Courses they are building',
        knowledge: 'From their own notes & documents (cite when used)',
      };
      for (const [source, label] of Object.entries(labels)) {
        const group = ctx.facts.filter((f) => f.source === source);
        if (group.length)
          lines.push(`${label}:`, ...group.map((f) => `- ${f.text}`));
      }
    } else if (ctx.memories?.length) {
      lines.push(
        'Remembered:',
        ...ctx.memories.slice(0, 6).map((m) => `- (${m.kind}) ${m.content}`),
      );
    }
    if (ctx.summary?.trim()) {
      lines.push(`Conversation so far: ${ctx.summary.trim()}`);
    }
    return lines.length ? `LEARNER CONTEXT\n${lines.join('\n')}` : '';
  }

  async streamAnswer(
    ctx: AgentRuntimeContext,
    opts: ComposeOptions,
  ): Promise<string> {
    const user = opts.user ?? ctx.request.message;
    const securityNote = ctx.request.context?.['securityNote'];

    this.logger.log(
      `[LLM-COMPOSER] Starting answer composition | operation: ${opts.operation} | agentType: ${opts.agentType} | isLive: ${this.ai.isLive} | provider: ${this.ai.providerName} | strategy: ${this.ai.strategy}`,
    );

    if (this.ai.isLive) {
      try {
        const system = [
          opts.system,
          this.contextBlock(ctx),
          typeof securityNote === 'string' ? securityNote : '',
        ]
          .filter(Boolean)
          .join('\n\n')
          .trim();
        const history: AIMessage[] = (ctx.history ?? []).map((h) => ({
          role: h.role,
          content: h.content,
        }));
        const messages: AIMessage[] = [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: user },
        ];
        const meta = {
          userId: ctx.request.userId,
          agentType: opts.agentType,
          operation: opts.operation,
        };

        if (this.ai.strategy === 'fallback') {
          // Stream real tokens live (best UX / lowest latency).
          this.logger.log(
            `[LLM-COMPOSER] Streaming real tokens from ${this.ai.providerName} (fallback strategy)`,
          );
          let acc = '';
          for await (const token of this.ai.streamText(messages, {
            temperature: opts.temperature ?? 0.5,
            meta,
          })) {
            acc += token;
            ctx.emit({ type: 'chunk', messageId: '', delta: token });
          }
          if (acc.trim()) {
            this.logger.log(
              `[LLM-COMPOSER] Successfully streamed ${acc.length} chars from ${this.ai.providerName}`,
            );
            return acc;
          }
        } else {
          // refine (draft→self-critique) / parallel (race→judge): compute, then stream the result.
          this.logger.log(`[LLM-COMPOSER] Using ${this.ai.strategy} strategy`);
          ctx.emit({
            type: 'thinking',
            messageId: '',
            label:
              this.ai.strategy === 'refine'
                ? 'Drafting & self-critiquing'
                : 'Comparing providers & synthesizing',
          });
          const text = await this.ai.composeWithStrategy(messages, {
            temperature: opts.temperature ?? 0.5,
            meta,
          });
          if (text.trim()) {
            this.logger.log(
              `[LLM-COMPOSER] Composed ${text.length} chars via ${this.ai.strategy}`,
            );
            await this.streamFallback(text, ctx);
            return text;
          }
        }
      } catch (err) {
        this.logger.warn(
          `[LLM-COMPOSER] Live API call failed (falling back to mock): ${(err as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        `[LLM-COMPOSER] No live LLM provider configured - using MOCK responses`,
      );
    }

    this.logger.log(
      `[LLM-COMPOSER] Falling back to deterministic answer (${opts.operation})`,
    );
    await this.streamFallback(opts.fallback, ctx);
    // Record a usage row for the deterministic path too, so analytics stay populated
    // offline (the live path is auto-logged by AiService via `meta`).
    await this.ai.logUsage({
      userId: ctx.request.userId,
      agentType: opts.agentType,
      operation: opts.operation,
      tokensIn: estimateTokens(user),
      tokensOut: estimateTokens(opts.fallback),
    });
    return opts.fallback;
  }

  /** Word-chunk the deterministic answer so the typing effect is preserved offline. */
  private async streamFallback(
    text: string,
    ctx: AgentRuntimeContext,
  ): Promise<void> {
    for (const token of text.split(/(\s+)/)) {
      ctx.emit({ type: 'chunk', messageId: '', delta: token });
      await new Promise((r) => setTimeout(r, 6));
    }
  }
}
