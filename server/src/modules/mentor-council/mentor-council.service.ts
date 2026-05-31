import { Injectable } from '@nestjs/common';
import { LearningIntelligenceService } from '../learning-intelligence/learning-intelligence.service';
import { FlowsService } from '../flows/flows.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { StudentProfileService } from '../student-profile/student-profile.service';

export interface CouncilProposal {
  agent: string;
  glyph: string;
  stance: string;
  recommendation: string;
  rationale: string;
  route: string;
  urgency: number; // 0–100
}

export interface CouncilVerdict {
  members: CouncilProposal[];
  chosen: CouncilProposal;
  synthesis: string;
}

/**
 * AI Mentor Council — five agent perspectives (Tutor / Mentor / Assessment / Project / Career) each
 * propose the learner's next best move from shared signals; a chair scores urgency and picks one,
 * with a synthesis that also credits the runners-up. Deterministic + explainable (read-only).
 */
@Injectable()
export class MentorCouncilService {
  constructor(
    private readonly li: LearningIntelligenceService,
    private readonly flows: FlowsService,
    private readonly mistakes: MistakesService,
    private readonly profiles: StudentProfileService,
  ) {}

  async convene(userId: string): Promise<CouncilVerdict> {
    const [overview, activeFlow, open, profile] = await Promise.all([
      this.li.overview(userId),
      this.flows.findActive(userId),
      this.mistakes.list(userId, 'open'),
      this.profiles.findByUser(userId),
    ]);

    const topMistake = [...open].sort((a, b) => b.severity - a.severity)[0];
    const readiness = overview.readinessScore;
    const activeDays = overview.momentum.activeDays;
    const projects = overview.momentum.projects;
    const weakness = overview.weaknesses[0];
    const nextNode = activeFlow?.nodes.find((n) => n.status === 'available' || n.status === 'in_progress');
    const goal = profile?.mainGoal ?? 'your goal';

    const members: CouncilProposal[] = [
      {
        agent: 'Tutor Agent',
        glyph: '🎓',
        stance: 'Understanding comes first.',
        recommendation: nextNode ? `Learn "${nextNode.title}" next` : `Study the fundamentals of ${weakness?.topic ?? goal}`,
        rationale: nextNode ? 'It is the next unlocked step in your active flow.' : 'No active flow node — solidify the basics before pushing ahead.',
        route: nextNode && activeFlow ? `/app/flows/${String(activeFlow._id)}` : '/app/tutor',
        urgency: nextNode ? 55 : 60,
      },
      {
        agent: 'Assessment Agent',
        glyph: '✓',
        stance: 'Prove it, don\'t assume it.',
        recommendation: topMistake ? `Repair & re-test "${topMistake.concept}"` : 'Take a mastery quiz on your weakest topic',
        rationale: topMistake ? `An open ${topMistake.mistakeType.replace('_', ' ')} at severity ${topMistake.severity}/100 — retrieval practice closes it.` : 'Periodic testing keeps recall sharp.',
        route: topMistake ? '/app/mistakes' : '/app/quizzes',
        urgency: topMistake ? 50 + Math.round(topMistake.severity / 2.5) : 45,
      },
      {
        agent: 'Project Agent',
        glyph: '⬢',
        stance: 'You learn by building.',
        recommendation: 'Build a small project that applies what you know',
        rationale: projects === 0 ? 'You have no projects yet — hands-on work compounds learning and readiness.' : 'Another applied project deepens transfer.',
        route: '/app/projects',
        urgency: projects === 0 ? 58 : 35,
      },
      {
        agent: 'Career Agent',
        glyph: '💼',
        stance: 'Aim at the goal.',
        recommendation: readiness < 65 ? 'Run a mock interview to expose gaps' : 'Polish your portfolio for the goal',
        rationale: `Readiness for ${goal} is ${readiness}/100${readiness < 65 ? ' — simulations surface what to fix.' : ' — convert mastery into proof.'}`,
        route: '/app/simulations',
        urgency: readiness < 50 ? 62 : readiness < 65 ? 48 : 30,
      },
      {
        agent: 'Mentor Agent',
        glyph: '🧑‍🏫',
        stance: 'Sustainable pace wins.',
        recommendation: activeDays <= 2 ? 'Do one small thing today to rebuild momentum' : 'Keep your streak — follow today\'s plan',
        rationale: activeDays <= 2 ? `Only ${activeDays} active day(s) recently — a tiny win restarts the habit.` : `You have momentum (${activeDays} active days) — protect it.`,
        route: '/app/today',
        urgency: activeDays <= 1 ? 70 : activeDays <= 2 ? 52 : 33,
      },
    ];

    const sorted = [...members].sort((a, b) => b.urgency - a.urgency);
    const chosen = sorted[0];
    const runnerUp = sorted[1];
    const synthesis = `The council leans toward the ${chosen.agent} this round: ${chosen.recommendation.toLowerCase()}. ${chosen.rationale} The ${runnerUp.agent} also made a strong case (${runnerUp.recommendation.toLowerCase()}) — do that next.`;

    return { members: sorted, chosen, synthesis };
  }
}
