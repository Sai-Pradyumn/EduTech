import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../ai/gateway/llm-gateway.service';
import { AIMessage } from '../ai/interfaces/ai-provider.interface';

export const GUARDIAN_VERDICTS = ['solid', 'careful', 'uncertain'] as const;
export type GuardianVerdictKind = (typeof GUARDIAN_VERDICTS)[number];

export interface GuardianVerdict {
  /** solid = trustworthy · careful = mostly right, mind the caveats · uncertain = verify before trusting. */
  verdict: GuardianVerdictKind;
  confidence: number; // 0–1
  concerns: string[];
  suggestion: string;
  /** True when the learner should be guided (hint-first) rather than handed the answer. */
  hintFirst: boolean;
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: GUARDIAN_VERDICTS },
    confidence: { type: 'number' },
    concerns: { type: 'array', items: { type: 'string' } },
    suggestion: { type: 'string' },
    hintFirst: { type: 'boolean' },
  },
  required: ['verdict', 'confidence', 'concerns', 'suggestion', 'hintFirst'],
};

const SYSTEM = `You are Asta's Cognitive Guardian — a careful reviewer of a tutor's answer.
Judge the answer for: factual correctness, hidden misconceptions, hallucination risk, and whether it
simply hands over an answer the learner should reason out themselves.
Return JSON only:
- verdict: "solid" (trustworthy), "careful" (mostly right but note caveats), or "uncertain" (verify first).
- confidence: 0..1.
- concerns: short, specific issues (empty if none). Max 3.
- suggestion: one calm next step for the learner (e.g. "predict the output first").
- hintFirst: true if the learner would learn more from a hint than this full answer.
Be honest; never claim certainty you don't have.`;

/**
 * Deep Cognitive Guardian: a real LLM verification pass over a tutor answer. Uses
 * the shared LLM gateway (with mock fallback) so it works with no keys. On-demand
 * (the client calls it for "double-check"), so it adds no latency to normal answers.
 * Never throws — returns a cautious verdict if the model/JSON misbehaves.
 */
@Injectable()
export class CognitiveGuardianService {
  private readonly logger = new Logger(CognitiveGuardianService.name);

  constructor(private readonly llm: LlmGatewayService) {}

  async review(question: string, answer: string): Promise<GuardianVerdict> {
    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Learner asked:\n${question.slice(0, 4000)}\n\nTutor answered:\n${answer.slice(0, 8000)}\n\nReview it.`,
      },
    ];
    try {
      const raw = await this.llm.generateStructuredOutput<
        Partial<GuardianVerdict>
      >(messages, SCHEMA);
      return this.normalize(raw);
    } catch (err) {
      this.logger.warn(`Guardian review failed: ${(err as Error).message}`);
      return {
        verdict: 'careful',
        confidence: 0.6,
        concerns: [],
        suggestion:
          'Double-check the key claims yourself before relying on them.',
        hintFirst: false,
      };
    }
  }

  private normalize(v: Partial<GuardianVerdict> | undefined): GuardianVerdict {
    const verdict = GUARDIAN_VERDICTS.includes(
      v?.verdict as GuardianVerdictKind,
    )
      ? (v!.verdict as GuardianVerdictKind)
      : 'careful';
    const confidence =
      typeof v?.confidence === 'number'
        ? Math.max(0, Math.min(1, v.confidence))
        : 0.7;
    const concerns = Array.isArray(v?.concerns)
      ? v.concerns.filter((c) => typeof c === 'string').slice(0, 3)
      : [];
    return {
      verdict,
      confidence,
      concerns,
      suggestion:
        typeof v?.suggestion === 'string' && v.suggestion
          ? v.suggestion
          : 'Try explaining it back in your own words to be sure.',
      hintFirst: v?.hintFirst === true,
    };
  }
}
