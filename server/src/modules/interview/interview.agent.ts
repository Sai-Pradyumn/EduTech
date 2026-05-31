import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../common/enums';
import { AiService } from '../ai/ai.service';

export interface AnswerScore {
  score: number; // 0–100
  feedback: string;
  missing: string[];
}

/**
 * Phase 9 · InterviewCoachAgent — scores a spoken/typed interview answer and gives terse, useful
 * feedback. LLM when live; a transparent deterministic heuristic otherwise (offline-safe).
 */
@Injectable()
export class InterviewCoachAgent {
  private readonly logger = new Logger(InterviewCoachAgent.name);

  constructor(private readonly ai: AiService) {}

  async scoreAnswer(userId: string, question: string, answer: string): Promise<AnswerScore> {
    const fallback = this.heuristic(answer);
    if (!this.ai.isLive || answer.trim().length < 4) return fallback;
    try {
      const out = await this.ai.generateStructuredOutput<AnswerScore>(
        [
          { role: 'system', content: 'You are a tough but fair technical interviewer. Score the candidate answer 0–100 and give ONE terse sentence of feedback plus up to 2 missing points. Reward correctness, structure and concrete examples.' },
          { role: 'user', content: `Question: ${question}\nAnswer: ${answer}` },
        ],
        { type: 'object', properties: { score: { type: 'number' }, feedback: { type: 'string' }, missing: { type: 'array', items: { type: 'string' } } }, required: ['score', 'feedback'] },
        { temperature: 0.3, meta: { userId, agentType: AgentType.Career, operation: 'interview.score' }, mockFactory: () => fallback },
      );
      const score = Math.max(0, Math.min(100, Math.round(out.score ?? fallback.score)));
      return { score, feedback: out.feedback || fallback.feedback, missing: out.missing ?? [] };
    } catch (err) {
      this.logger.warn(`Interview score failed: ${(err as Error).message}`);
      return fallback;
    }
  }

  /** Transparent heuristic: rewards substance + structure markers; never claims to grade correctness. */
  private heuristic(answer: string): AnswerScore {
    const a = answer.trim();
    const words = a.split(/\s+/).filter(Boolean).length;
    if (words < 5) return { score: 30, feedback: 'Too brief — interviewers want reasoning, not a one-liner. Expand with a concrete example.', missing: ['structure', 'an example'] };
    const hasExample = /\b(example|for instance|e\.g\.|in my project|when i)\b/i.test(a);
    const hasStructure = /\b(first|then|because|so|trade-?off|however|approach)\b/i.test(a);
    let score = 52 + Math.min(28, Math.round(words / 6));
    if (hasExample) score += 8;
    if (hasStructure) score += 6;
    score = Math.min(92, score);
    const missing: string[] = [];
    if (!hasExample) missing.push('a concrete example');
    if (!hasStructure) missing.push('clearer structure (first… then… because…)');
    return {
      score,
      feedback: hasExample && hasStructure ? 'Solid, structured answer with an example — tighten and you\'re interview-ready.' : 'Reasonable answer — add ' + (missing[0] ?? 'more depth') + ' to make it stronger.',
      missing,
    };
  }
}
