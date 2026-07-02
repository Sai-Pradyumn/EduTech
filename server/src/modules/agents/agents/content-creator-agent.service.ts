import { Injectable } from '@nestjs/common';
import { AgentType, Intent } from '../../../common/enums';
import { AgentResponse } from '../../ai/types/agent.types';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';
import { LlmComposerService } from '../core/llm-composer.service';
import { VisualComposerService } from '../core/visual-composer.service';
import { personaFor } from '../prompts/personas';

type Format = 'notes' | 'flashcards' | 'summary' | 'cheatsheet';

function detectFormat(message: string): Format {
  const m = message.toLowerCase();
  if (/flashcard|flash card|q ?& ?a|recall card/.test(m)) return 'flashcards';
  if (/summar|tl;?dr|brief/.test(m)) return 'summary';
  if (/cheat ?sheet|quick ref|reference/.test(m)) return 'cheatsheet';
  return 'notes';
}

/**
 * Content-creator agent — generates study material (notes / cheat-sheet / summary /
 * flashcards) on a topic, tuned to the student's level and preferred language. Output is
 * structured markdown plus a study plan and (for flashcards) a recall QuizBlock.
 */
@Injectable()
export class ContentCreatorAgentService implements IAgent {
  readonly type = AgentType.ContentCreator;

  constructor(
    private readonly composer: LlmComposerService,
    private readonly visuals: VisualComposerService,
  ) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    const format = detectFormat(ctx.request.message);
    const topic = this.extractTopic(ctx.request.message);
    const level = ctx.profile?.currentSkillLevel ?? 'beginner';

    ctx.emit({
      type: 'thinking',
      messageId: '',
      label: `Drafting ${format} on ${topic}`,
    });
    ctx.emit({
      type: 'tool_call',
      messageId: '',
      tool: 'content.generate',
      label: `Tuning to your level (${level})`,
    });
    ctx.emit({
      type: 'tool_result',
      messageId: '',
      tool: 'content.generate',
      summary: `${format} ready`,
    });

    const fallback = this.buildContent(format, topic, level);
    const system =
      `${personaFor(AgentType.ContentCreator)}\n` +
      `Produce: ${format} on "${topic}", tuned to a ${level} learner. Use clean markdown` +
      `${format === 'cheatsheet' ? ' (include a reference table)' : ''}.`;
    const answer = await this.composer.streamAnswer(ctx, {
      system,
      fallback,
      agentType: AgentType.ContentCreator,
      operation: `content.${format}`,
      temperature: 0.6,
    });

    // Visuals come from the generated material itself (quiz from the actual
    // flashcards, plan from the actual steps) — attached only when they help.
    const blocks = await this.visuals.compose(ctx.request.message, answer, {
      topic,
      agentType: AgentType.ContentCreator,
      userId: ctx.request.userId,
    });
    for (const b of blocks)
      ctx.emit({ type: 'visual_block', messageId: '', block: b });

    return {
      agentType: AgentType.ContentCreator,
      intent: Intent.ContentGeneration,
      mode: 'mixed',
      answer,
      actions: [
        {
          id: 'flash',
          label: 'Make flashcards',
          kind: 'custom',
          payload: { topic, format: 'flashcards' },
        },
        {
          id: 'quiz',
          label: 'Quiz me on this',
          kind: 'generate_quiz',
          payload: { topic },
        },
        {
          id: 'simpler',
          label: 'Explain simpler',
          kind: 'simpler',
          payload: { topic },
        },
      ],
      visualBlocks: blocks,
      confidence: 0.84,
      followUpQuestions: [
        `Make a cheat-sheet for ${topic}`,
        `Turn this into flashcards`,
        `Give me practice questions on ${topic}`,
      ],
      recommendedNextActions: [
        `Test yourself on ${topic} in the Quiz Studio`,
        'Revisit these notes tomorrow (spaced repetition)',
      ],
    };
  }

  private buildContent(format: Format, topic: string, level: string): string {
    const t = this.titleCase(topic);
    if (format === 'summary') {
      return [
        `### ${t} — TL;DR`,
        '',
        `**In one line:** ${t} is a ${level}-level concept worth knowing because it shows up in real work and interviews.`,
        '',
        '**Key points**',
        `- The core idea and the problem it solves`,
        `- How it works, step by step`,
        `- When to use it (and when not to)`,
        `- A common mistake to avoid`,
        '',
        '_Want the full notes or flashcards? Just ask._',
      ].join('\n');
    }
    if (format === 'cheatsheet') {
      return [
        `### ${t} — Cheat-sheet`,
        '',
        '| Thing | Quick reference |',
        '|---|---|',
        `| What | The essence of ${t} in a sentence |`,
        '| Syntax / shape | The canonical form you’ll write |',
        '| Gotchas | The 1–2 mistakes everyone makes |',
        '| When | The situations it’s the right tool for |',
        '',
        `_Pin this; it’s the 80/20 of ${t}._`,
      ].join('\n');
    }
    if (format === 'flashcards') {
      return [
        `### ${t} — Flashcards`,
        '',
        `**Q1.** What is ${t} in one sentence?`,
        `**A1.** The core definition.`,
        '',
        `**Q2.** When would you use ${t}?`,
        `**A2.** The main use-case + a trade-off.`,
        '',
        `**Q3.** What’s a common mistake with ${t}?`,
        `**A3.** The pitfall and how to avoid it.`,
        '',
        '_Use the recall quiz on the right — cover the answers first._',
      ].join('\n');
    }
    return [
      `### ${t} — Study notes`,
      '',
      `**1. The big idea.** What ${t} is and the problem it solves.`,
      '',
      `**2. How it works.**`,
      `- The mechanism, step by step`,
      `- A small concrete example`,
      '',
      `**3. When to use it.** The situations where ${t} is the right call — and when it isn’t.`,
      '',
      `**4. Common mistakes.**`,
      `- The mistake most ${level}s make`,
      `- How to catch it early`,
      '',
      `**5. Recall prompts.** Cover the page and answer: *What is ${t}? When? One pitfall?*`,
    ].join('\n');
  }

  private extractTopic(message: string): string {
    const cleaned = message
      .toLowerCase()
      .replace(
        /^(can you |please )?(generate|make|create|write|give me)\s+/i,
        '',
      )
      .replace(
        /\b(notes|flashcards|flash cards|a summary|summary|cheat ?sheet|study (notes|material))\b/gi,
        '',
      )
      .replace(/\b(on|about|for|of)\b/gi, ' ')
      .replace(/[?.!]+$/, '')
      .trim();
    return cleaned || 'this topic';
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
