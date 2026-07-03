import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import {
  buildQuestions,
  INTERVIEW_TYPE_META,
  InterviewType,
} from './interview-bank';

export interface AnswerScore {
  score: number; // 0–100
  feedback: string;
  missing: string[];
}

/** The profile slice used to tailor generated questions to the learner. */
export interface QuestionProfile {
  mainGoal?: string;
  currentSkillLevel?: string;
  currentSkills?: string[];
  weakAreas?: string[];
}

/** Company archetypes — each one shifts the interviewing style + difficulty ladder. */
export const COMPANY_ARCHETYPES = {
  startup: {
    label: 'Startup',
    style:
      'Scrappy startup interview: practical shipping ability, breadth, ownership. Probe real building experience, ambiguity tolerance and speed-vs-quality trade-offs.',
  },
  big_tech: {
    label: 'Big Tech',
    style:
      'Big-Tech (FAANG-style) interview: rigorous fundamentals, algorithms and data-structure depth, scalability thinking. The ladder should end at a genuinely hard question.',
  },
  consulting: {
    label: 'Consulting',
    style:
      'Consulting-style interview: structured problem decomposition, client-ready communication, estimation. Case-flavoured questions that demand a spoken framework.',
  },
  enterprise: {
    label: 'Enterprise',
    style:
      'Large-enterprise interview: reliability, maintainability, process discipline, cross-team collaboration and integrating with legacy systems.',
  },
} as const;
export type CompanyArchetype = keyof typeof COMPANY_ARCHETYPES;
export const ARCHETYPE_IDS = Object.keys(
  COMPANY_ARCHETYPES,
) as CompanyArchetype[];

/**
 * Phase 9 · InterviewCoachAgent — scores a spoken/typed interview answer and gives terse, useful
 * feedback. LLM when live; a transparent deterministic heuristic otherwise (offline-safe).
 */
@Injectable()
export class InterviewCoachAgent {
  private readonly logger = new Logger(InterviewCoachAgent.name);

  constructor(private readonly ai: AiService) {}

  /**
   * Interview questions tailored to the role AND this learner (goal, skills, weak
   * areas) when an LLM is live. The deterministic bank is the offline fallback —
   * generation never being available must not block an interview.
   */
  async generateQuestions(
    userId: string,
    type: InterviewType,
    role: string,
    profile?: QuestionProfile | null,
    archetype?: CompanyArchetype,
  ): Promise<string[]> {
    const fallback = buildQuestions(type, role);
    if (!this.ai.isLive) return fallback;

    const meta = INTERVIEW_TYPE_META[type];
    const company = archetype ? COMPANY_ARCHETYPES[archetype] : undefined;
    const learner = [
      profile?.mainGoal ? `Goal: ${profile.mainGoal}` : '',
      profile?.currentSkillLevel ? `Level: ${profile.currentSkillLevel}` : '',
      profile?.currentSkills?.length
        ? `Knows: ${profile.currentSkills.join(', ')}`
        : '',
      profile?.weakAreas?.length
        ? `Weak areas (probe at least one): ${profile.weakAreas.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const out = await this.ai.generateStructuredOutput<{
        questions: string[];
      }>(
        [
          {
            role: 'system',
            content:
              `You are a senior interviewer running a ${meta.label} interview for a "${role}" role ` +
              `(focus: ${meta.focus}). ` +
              (company ? `${company.style} ` : '') +
              'Write 5 sharp, realistic interview questions a real interviewer would ask, tailored to ' +
              'this candidate. Build a strict difficulty ladder: question 1 is an approachable warm-up, ' +
              'each question is clearly harder than the last, and question 5 is a genuine stretch. ' +
              'One question per item; no numbering, no preamble.',
          },
          {
            role: 'user',
            content: learner || `Candidate is preparing for: ${role}`,
          },
        ],
        {
          type: 'object',
          properties: {
            questions: { type: 'array', items: { type: 'string' } },
          },
          required: ['questions'],
        },
        {
          temperature: 0.7,
          meta: {
            userId,
            agentType: AgentType.Career,
            operation: 'interview.questions',
          },
          mockFactory: () => ({ questions: fallback }),
        },
      );
      const questions = (out.questions ?? [])
        .map((q) => String(q).trim())
        .filter((q) => q.length >= 12 && q.length <= 400)
        .slice(0, 6);
      // A degenerate generation (too few usable questions) falls back to the bank.
      return questions.length >= 4 ? questions : fallback;
    } catch (err) {
      this.logger.warn(
        `Interview question generation failed: ${(err as Error).message}`,
      );
      return fallback;
    }
  }

  async scoreAnswer(
    userId: string,
    question: string,
    answer: string,
  ): Promise<AnswerScore> {
    const fallback = this.heuristic(answer);
    if (!this.ai.isLive || answer.trim().length < 4) return fallback;
    try {
      const out = await this.ai.generateStructuredOutput<AnswerScore>(
        [
          {
            role: 'system',
            content:
              'You are a tough but fair technical interviewer. Score the candidate answer 0–100 and give ONE terse sentence of feedback plus up to 2 missing points. Reward correctness, structure and concrete examples.',
          },
          { role: 'user', content: `Question: ${question}\nAnswer: ${answer}` },
        ],
        {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
            missing: { type: 'array', items: { type: 'string' } },
          },
          required: ['score', 'feedback'],
        },
        {
          temperature: 0.3,
          meta: {
            userId,
            agentType: AgentType.Career,
            operation: 'interview.score',
          },
          mockFactory: () => fallback,
        },
      );
      const score = Math.max(
        0,
        Math.min(100, Math.round(out.score ?? fallback.score)),
      );
      return {
        score,
        feedback: out.feedback || fallback.feedback,
        missing: out.missing ?? [],
      };
    } catch (err) {
      this.logger.warn(`Interview score failed: ${(err as Error).message}`);
      return fallback;
    }
  }

  /** Transparent heuristic: rewards substance + structure markers; never claims to grade correctness. */
  private heuristic(answer: string): AnswerScore {
    const a = answer.trim();
    const words = a.split(/\s+/).filter(Boolean).length;
    if (words < 5)
      return {
        score: 30,
        feedback:
          'Too brief — interviewers want reasoning, not a one-liner. Expand with a concrete example.',
        missing: ['structure', 'an example'],
      };
    const hasExample =
      /\b(example|for instance|e\.g\.|in my project|when i)\b/i.test(a);
    const hasStructure =
      /\b(first|then|because|so|trade-?off|however|approach)\b/i.test(a);
    let score = 52 + Math.min(28, Math.round(words / 6));
    if (hasExample) score += 8;
    if (hasStructure) score += 6;
    score = Math.min(92, score);
    const missing: string[] = [];
    if (!hasExample) missing.push('a concrete example');
    if (!hasStructure)
      missing.push('clearer structure (first… then… because…)');
    return {
      score,
      feedback:
        hasExample && hasStructure
          ? "Solid, structured answer with an example — tighten and you're interview-ready."
          : 'Reasonable answer — add ' +
            (missing[0] ?? 'more depth') +
            ' to make it stronger.',
      missing,
    };
  }
}
