import { Injectable } from '@nestjs/common';
import { AgentType, Intent } from '../../../common/enums';
import {
  AgentResponse,
  MentorFeedbackBlock,
  StudyPlanBlock,
  VisualBlock,
} from '../../ai/types/agent.types';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';

/** Senior-mentor agent: reviews progress, scores learning health, plans the week. */
@Injectable()
export class MentorAgentService implements IAgent {
  readonly type = AgentType.Mentor;

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    ctx.emit({ type: 'thinking', messageId: '', label: 'Reviewing your roadmap & recent activity' });
    ctx.emit({ type: 'tool_call', messageId: '', tool: 'progress.review', label: 'Computing learning-health score' });

    const progress = ctx.roadmap?.progressPercentage ?? 0;
    const weak = ctx.profile?.weakAreas ?? [];
    const name = ctx.profile?.fullName?.split(' ')[0] ?? 'there';

    const health = this.healthScore(progress, weak.length, !!ctx.roadmap);
    ctx.emit({ type: 'tool_result', messageId: '', tool: 'progress.review', summary: `Learning health ${health}/100` });

    const risks: string[] = [];
    if (!ctx.roadmap) risks.push('No active roadmap — your learning isn’t structured yet.');
    else if (progress < 15) risks.push('Early progress is low — momentum is the biggest risk right now.');
    if (weak.length >= 3) risks.push(`Several weak areas (${weak.slice(0, 3).join(', ')}) need deliberate practice.`);

    const actionPlan = [
      ctx.roadmap ? `Finish this week's focus: ${ctx.roadmap.currentWeekFocus ?? ctx.roadmap.title}` : 'Generate a roadmap to structure your goal',
      weak.length ? `Do 30 min of targeted practice on ${weak[0]}` : 'Take a quiz to surface hidden gaps',
      'Build or extend one small project this week',
    ];

    const mentorBlock: MentorFeedbackBlock = {
      type: 'mentor_feedback',
      title: 'Weekly mentor review',
      learningHealthScore: health,
      highlights: [
        ctx.roadmap ? `You're ${progress}% through "${ctx.roadmap.title}"` : 'Profile complete — ready to start',
        `Strengths: ${(ctx.profile?.currentSkills ?? ['fundamentals']).slice(0, 3).join(', ')}`,
      ],
      risks: risks.length ? risks : ['On track — keep the consistency going.'],
      actionPlan,
    };

    const weekPlan: StudyPlanBlock = {
      type: 'study_plan',
      title: 'Your plan for this week',
      items: actionPlan.map((label, i) => ({ label, minutes: i === 1 ? 30 : 45, kind: 'plan' })),
    };

    const blocks: VisualBlock[] = [mentorBlock, weekPlan];
    const answer = [
      `${name}, here's your honest weekly review.`,
      '',
      `**Learning health: ${health}/100.** ${this.healthNote(health)}`,
      '',
      risks.length ? `**What to watch:** ${risks[0]}` : '**You’re on track.** Keep the streak alive.',
      '',
      `**This week, in order:**`,
      ...actionPlan.map((a, i) => `${i + 1}. ${a}`),
    ].join('\n');

    await this.stream(answer, ctx);
    for (const block of blocks) ctx.emit({ type: 'visual_block', messageId: '', block });

    return {
      agentType: AgentType.Mentor,
      intent: Intent.MentorReview,
      mode: 'mixed',
      answer,
      actions: [
        { id: 'plan', label: 'Plan my week', kind: 'custom', payload: { action: 'plan_week' } },
        { id: 'roadmap', label: 'Open my roadmap', kind: 'open_route', payload: { route: '/app/roadmap' } },
        { id: 'tutor', label: 'Ask the tutor', kind: 'open_route', payload: { route: '/app/tutor' } },
      ],
      visualBlocks: blocks,
      confidence: 0.85,
      followUpQuestions: ['Why is my learning health where it is?', 'What should I prioritize this week?'],
      recommendedNextActions: actionPlan,
    };
  }

  private healthScore(progress: number, weakCount: number, hasRoadmap: boolean): number {
    let score = 50;
    if (hasRoadmap) score += 15;
    score += Math.round(progress * 0.3);
    score -= Math.min(20, weakCount * 5);
    return Math.max(5, Math.min(100, score));
  }

  private healthNote(score: number): string {
    if (score >= 75) return 'Strong and consistent — push into harder material.';
    if (score >= 50) return 'Solid base — focus on consistency and weak areas.';
    return 'Needs attention — small daily wins will turn this around fast.';
  }

  private async stream(text: string, ctx: AgentRuntimeContext): Promise<void> {
    for (const token of text.split(/(\s+)/)) {
      ctx.emit({ type: 'chunk', messageId: '', delta: token });
      await new Promise((r) => setTimeout(r, 7));
    }
  }
}
