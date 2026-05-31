import { Injectable } from '@nestjs/common';
import { AgentType, INTENT_AGENT_MAP, Intent } from '../../../common/enums';
import { PlanStep } from '../../ai/types/agent.types';
import { Classification } from './agent-router.service';

export interface Plan {
  steps: PlanStep[];
  rationale: string;
}

/**
 * Turns a classified request into an execution plan. Most messages are a single step
 * (route to one agent). Compound asks ("explain X and quiz me", "teach then build a
 * project") expand into a short chain the orchestrator runs in sequence, threading one
 * session so later steps see earlier context. Deterministic + cheap (no extra LLM call).
 */
@Injectable()
export class PlannerService {
  plan(
    message: string,
    classification: Classification,
    forcedAgent?: AgentType,
  ): Plan {
    const primaryAgent = forcedAgent ?? INTENT_AGENT_MAP[classification.intent];
    const topic = classification.entities.topic;
    const steps: PlanStep[] = [
      {
        agentType: primaryAgent,
        goal: this.goalFor(primaryAgent, message, topic),
      },
    ];

    if (!forcedAgent) {
      const extra = this.secondaryStep(
        message,
        classification,
        primaryAgent,
        topic,
      );
      if (extra) steps.push(extra);
    }

    return {
      steps,
      rationale:
        steps.length === 1
          ? `Handle this with the ${primaryAgent.replace('_', ' ')} agent.`
          : `Multi-step: ${steps.map((s) => s.agentType.replace('_', ' ')).join(' → ')}.`,
    };
  }

  /** Detect a clear secondary intent in the same message (kept conservative). */
  private secondaryStep(
    message: string,
    classification: Classification,
    primary: AgentType,
    topic?: string,
  ): PlanStep | null {
    const m = message.toLowerCase();
    const wantsQuiz = /\b(then|and)\b[^.]*\b(quiz|test me|assess)/.test(m);
    const wantsProject = /\b(then|and)\b[^.]*\b(build|project)/.test(m);
    const t = topic ?? 'this topic';

    if (wantsQuiz && primary !== AgentType.Assessment) {
      return {
        agentType: AgentType.Assessment,
        goal: `Quiz the student on ${t}.`,
      };
    }
    if (wantsProject && primary !== AgentType.ProjectBuilder) {
      return {
        agentType: AgentType.ProjectBuilder,
        goal: `Suggest a project to practice ${t}.`,
      };
    }
    // Explaining a brand-new concept naturally pairs with a quick check for understanding.
    if (
      primary === AgentType.Tutor &&
      classification.intent === Intent.ConceptExplanation &&
      /\bquiz|test\b/.test(m)
    ) {
      return {
        agentType: AgentType.Assessment,
        goal: `Quiz the student on ${t}.`,
      };
    }
    return null;
  }

  private goalFor(agent: AgentType, message: string, topic?: string): string {
    return topic ? `${message} (topic: ${topic})` : message;
  }
}
