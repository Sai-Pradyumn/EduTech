import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../common/enums';
import { AiService } from '../ai/ai.service';

/**
 * Phase 9 · PortfolioBuilderAgent — writes the human-facing copy for a portfolio (an "about"
 * paragraph and per-project case studies) grounded in the learner's real evidence. LLM when live,
 * deterministic fallback always (offline-safe, no paid keys).
 */
@Injectable()
export class PortfolioBuilderAgent {
  private readonly logger = new Logger(PortfolioBuilderAgent.name);

  constructor(private readonly ai: AiService) {}

  async about(
    userId: string,
    name: string,
    targetRole: string,
    topSkills: string[],
    proofCount: number,
  ): Promise<string> {
    const fallback =
      `${name} is an aspiring ${targetRole} building real, verifiable proof of skill. ` +
      `Strengths so far: ${topSkills.slice(0, 4).join(', ') || 'a growing foundation'}. ` +
      `${proofCount} verified learning events back this profile — every claim here is something ${name.split(' ')[0]} has actually done.`;
    if (!this.ai.isLive) return fallback;
    try {
      const out = await this.ai.generateText(
        [
          {
            role: 'system',
            content:
              'Write a confident, concrete 2–3 sentence portfolio "about" paragraph in third person. Ground it ONLY in the facts given. No clichés, no buzzwords, no markdown.',
          },
          {
            role: 'user',
            content: `Name: ${name}. Target role: ${targetRole}. Top skills: ${topSkills.join(', ')}. Verified proof events: ${proofCount}.`,
          },
        ],
        {
          temperature: 0.5,
          maxTokens: 180,
          meta: {
            userId,
            agentType: AgentType.Career,
            operation: 'portfolio.about',
          },
        },
      );
      return out?.trim() || fallback;
    } catch (err) {
      this.logger.warn(`Portfolio about failed: ${(err as Error).message}`);
      return fallback;
    }
  }

  async caseStudy(
    userId: string,
    title: string,
    stack: string[],
    features: string[],
    aiScore: number | null,
  ): Promise<string> {
    const fallback =
      `${title} — a ${stack.slice(0, 3).join(' · ') || 'full-stack'} project. ` +
      `${
        features
          .slice(0, 3)
          .map((f) => f)
          .join('; ') || 'Built end to end'
      }.` +
      (aiScore
        ? ` AI review scored it ${aiScore}/100 for quality and architecture.`
        : '');
    if (!this.ai.isLive) return fallback;
    try {
      const out = await this.ai.generateText(
        [
          {
            role: 'system',
            content:
              'Write a crisp 2–3 sentence project case study for a portfolio: what it does, the stack, and the impact/quality. Ground ONLY in the facts. No markdown.',
          },
          {
            role: 'user',
            content: `Project: ${title}. Stack: ${stack.join(', ')}. Features: ${features.join(', ')}. AI review score: ${aiScore ?? 'n/a'}.`,
          },
        ],
        {
          temperature: 0.5,
          maxTokens: 160,
          meta: {
            userId,
            agentType: AgentType.ProjectBuilder,
            operation: 'portfolio.case_study',
          },
        },
      );
      return out?.trim() || fallback;
    } catch (err) {
      this.logger.warn(`Case study failed: ${(err as Error).message}`);
      return fallback;
    }
  }
}
