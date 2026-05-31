import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { CouncilAction } from './outcome-council.types';

/**
 * Phase 9 · The AI Outcome Council's narrator. Several specialist perspectives each propose a next
 * action (deterministically, grounded in the learner's data); this agent turns the winning action +
 * runners-up into a short, decisive "council verdict". LLM when live, deterministic fallback always.
 */
@Injectable()
export class OutcomeCouncilAgent {
  private readonly logger = new Logger(OutcomeCouncilAgent.name);

  constructor(private readonly ai: AiService) {}

  async verdict(userId: string, roleTitle: string, readiness: number, best: CouncilAction, alternatives: CouncilAction[]): Promise<string> {
    const fallback = this.fallback(roleTitle, readiness, best, alternatives);
    if (!this.ai.isLive) return fallback;
    try {
      const system =
        'You are the AI Outcome Council — a panel of specialist mentors deciding a learner\'s single best next action. ' +
        'In 2–4 sentences, state the chosen action, why it wins over the alternatives, and the risk of ignoring it. ' +
        'Be decisive and specific; no headings, no lists.';
      const user =
        `Target role: ${roleTitle}. Readiness: ${readiness}%.\n` +
        `Chosen: ${best.action} (proposed by ${best.agent}; impact ${best.expectedImpact}). Why: ${best.why}. Risk if ignored: ${best.riskIfIgnored}.\n` +
        `Alternatives: ${alternatives.map((a) => `${a.action} (${a.agent}, impact ${a.expectedImpact})`).join('; ') || 'none'}.`;
      const out = await this.ai.generateText(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { temperature: 0.45, maxTokens: 220, meta: { userId, agentType: AgentType.Mentor, operation: 'outcome_council.verdict' } },
      );
      return out?.trim() || fallback;
    } catch (err) {
      this.logger.warn(`Council verdict failed, using fallback: ${(err as Error).message}`);
      return fallback;
    }
  }

  private fallback(roleTitle: string, readiness: number, best: CouncilAction, alternatives: CouncilAction[]): string {
    const alt = alternatives[0] ? ` It edged out "${alternatives[0].action}" because it moves your readiness needle faster right now.` : '';
    return `The council's verdict: **${best.action}**. ${best.why}${alt} At ${readiness}% ready for ${roleTitle}, the risk of skipping it: ${best.riskIfIgnored.toLowerCase()}`;
  }
}
