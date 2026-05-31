import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { NextAction } from '../../ai/types/agent.types';
import { AgentRuntimeContext } from './agent.interface';
import { LoadedContext } from './agent-context.service';

type NextSource = Pick<LoadedContext, 'profile' | 'roadmap'>;

/**
 * Decides the single best "next move" for a learner from their current state — the engine
 * that keeps Asta a step ahead. Deterministic + cheap (no LLM): prioritizes closing weak
 * areas, then advancing the active roadmap, then structure (generate a roadmap), then
 * practice/projects. Used by the orchestrator (attached to every answer) and the
 * dashboard "Your next move" card.
 */
@Injectable()
export class NextActionService {
  fromContext(ctx: AgentRuntimeContext): NextAction {
    return this.decide({ profile: ctx.profile, roadmap: ctx.roadmap });
  }

  decide(src: NextSource): NextAction {
    const weak = src.profile?.weakAreas ?? [];
    const roadmap = src.roadmap;

    // 1) A flagged weak area is the highest-leverage thing to fix.
    if (weak.length) {
      const topic = weak[0];
      return {
        kind: 'revise',
        label: `Shore up ${topic}`,
        reason: `${topic} is flagged as a weak area — a short focused session now prevents it compounding.`,
        agentType: AgentType.Tutor,
        prompt: `Teach me ${topic} from the basics with an example, then quiz me.`,
        route: '/app/tutor',
      };
    }

    // 2) Advance the active roadmap toward this week's focus.
    if (roadmap?.currentWeekFocus) {
      return {
        kind: 'roadmap',
        label: `Continue: ${roadmap.currentWeekFocus}`,
        reason: `You're ${roadmap.progressPercentage}% through "${roadmap.title}". Keep momentum on this week's focus.`,
        agentType: AgentType.Tutor,
        prompt: `Help me with this week's focus: ${roadmap.currentWeekFocus}.`,
        route: '/app/roadmap',
      };
    }

    // 3) No roadmap yet → structure the learning.
    if (!roadmap) {
      return {
        kind: 'roadmap',
        label: 'Generate your learning roadmap',
        reason:
          'You don’t have an active roadmap — a structured path makes progress measurable.',
        agentType: AgentType.Roadmap,
        prompt: `Create a learning roadmap for my goal: ${src.profile?.mainGoal ?? 'my goal'}.`,
        route: '/app/roadmap',
      };
    }

    // 4) Roadmap done / mid-way with no weak areas → consolidate with a project.
    return {
      kind: 'project',
      label: 'Build a portfolio project',
      reason:
        'Apply what you’ve learned — a small project consolidates skills and strengthens your portfolio.',
      agentType: AgentType.ProjectBuilder,
      prompt: `Suggest a project that fits my goal: ${src.profile?.mainGoal ?? 'my goal'}.`,
      route: '/app/projects',
    };
  }
}
