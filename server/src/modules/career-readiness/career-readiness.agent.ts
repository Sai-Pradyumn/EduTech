import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { CareerRole } from './career-roles';

interface ExplainInput {
  role: CareerRole;
  readinessScore: number;
  band: string;
  dimensions: { label: string; score: number }[];
  topGaps: { skill: string; current: number; target: number }[];
  projectGap: { have: number; need: number; met: boolean };
  interviewGap: { score: number; met: boolean };
}

/**
 * Phase 9 · CareerReadinessAgent — turns the deterministic readiness analysis into a short,
 * human, grounded explanation ("why this score, what's missing, what moves it fastest"). Uses
 * the AI gateway when a key is live; otherwise returns a solid deterministic explanation so the
 * feature never depends on paid keys.
 */
@Injectable()
export class CareerReadinessAgent {
  private readonly logger = new Logger(CareerReadinessAgent.name);

  constructor(private readonly ai: AiService) {}

  async explain(userId: string, input: ExplainInput): Promise<string> {
    const fallback = this.fallback(input);
    if (!this.ai.isLive) return fallback;
    try {
      const system =
        "You are Asta's career-readiness coach. Explain a learner's readiness score for a target role in 3–5 short sentences. " +
        'Be specific and grounded ONLY in the numbers provided. Name the biggest lever and the single fastest action. ' +
        'No preamble, no markdown headings, warm but direct.';
      const user =
        `Target role: ${input.role.title} (${input.role.level}). Readiness: ${input.readinessScore}% (${input.band}).\n` +
        `Dimensions: ${input.dimensions.map((d) => `${d.label} ${d.score}`).join(', ')}.\n` +
        `Top skill gaps: ${input.topGaps.map((g) => `${g.skill} ${g.current}/${g.target}`).join('; ') || 'none'}.\n` +
        `Projects: ${input.projectGap.have}/${input.projectGap.need}${input.projectGap.met ? ' (met)' : ''}. ` +
        `Interview score: ${input.interviewGap.score}${input.interviewGap.met ? ' (met)' : ''}.`;
      const out = await this.ai.generateText(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        {
          temperature: 0.4,
          maxTokens: 280,
          meta: {
            userId,
            agentType: AgentType.Career,
            operation: 'career_readiness.explain',
          },
        },
      );
      return out?.trim() || fallback;
    } catch (err) {
      this.logger.warn(
        `Readiness explain failed, using fallback: ${(err as Error).message}`,
      );
      return fallback;
    }
  }

  private fallback(i: ExplainInput): string {
    const lead =
      i.band === 'ready'
        ? `You're essentially ready for ${i.role.title} — tighten the last gaps and start applying.`
        : i.band === 'close'
          ? `You're close to ${i.role.title}. A focused push closes the remaining gaps.`
          : i.band === 'building'
            ? `You have a real base for ${i.role.title}, but there's clear ground to cover.`
            : `It's early for ${i.role.title} — the plan below is your fastest route in.`;
    const lever = i.topGaps[0]
      ? `Your biggest lever is ${i.topGaps[0].skill} (${i.topGaps[0].current}/${i.topGaps[0].target}) — closing it moves the needle most.`
      : `Your skills are at target — now stack proof.`;
    const proof = !i.projectGap.met
      ? `You need ${i.projectGap.need - i.projectGap.have} more role-relevant project(s); that's what recruiters scan for first.`
      : !i.interviewGap.met
        ? `Run a mock interview for this role to prove you can perform under pressure.`
        : `Publish your proof so recruiters can verify it.`;
    return `${lead} ${lever} ${proof}`;
  }
}
