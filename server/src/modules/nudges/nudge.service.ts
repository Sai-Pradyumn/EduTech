import { Injectable } from '@nestjs/common';
import { SkillPassportService } from '../skill-passport/skill-passport.service';
import { CareerReadinessService } from '../career-readiness/career-readiness.service';

export interface Nudge {
  id: string;
  title: string;
  body: string;
  link: string;
  priority: number; // higher = more urgent
}

/**
 * Phase 9 · Nudge intelligence (pull) — computes the learner's current actionable nudges from live
 * state (readiness blockers, passport publish status, interview gap, mistakes). Ranked, de-duplicated.
 */
@Injectable()
export class NudgeService {
  constructor(
    private readonly passport: SkillPassportService,
    private readonly readiness: CareerReadinessService,
  ) {}

  async compute(userId: string): Promise<Nudge[]> {
    const [pv, analysis] = await Promise.all([
      this.passport.getMe(userId),
      this.readiness.getMe(userId),
    ]);
    const nudges: Nudge[] = [];

    if (analysis.blockers[0]) {
      nudges.push({
        id: 'blocker',
        title: `Clear your top blocker: ${analysis.blockers[0].title}`,
        body: analysis.blockers[0].impact,
        link: '/app/career-readiness',
        priority: 90,
      });
    }
    if (!analysis.interviewGap.met) {
      nudges.push({
        id: 'interview',
        title: 'Run a mock interview',
        body: analysis.interviewGap.score
          ? `Your interview score is ${analysis.interviewGap.score}/100 — push it higher.`
          : 'No interview evidence yet — get a baseline for your target role.',
        link: '/app/interview',
        priority: 75,
      });
    }
    if (pv.visibility !== 'public') {
      nudges.push({
        id: 'publish',
        title: 'Publish your Skill Passport',
        body: `${pv.proofSummary.verifiedEvents} verified events are ready — make them visible so recruiters can verify your skills.`,
        link: '/app/skill-passport',
        priority: 60,
      });
    }
    if (!analysis.projectGap.met) {
      nudges.push({
        id: 'project',
        title: 'Add more project proof',
        body: `${analysis.projectGap.have}/${analysis.projectGap.need} role-relevant projects — build one and add it to your passport.`,
        link: '/app/projects',
        priority: 70,
      });
    }
    if (
      pv.proofSummary.mistakesResolved === 0 &&
      pv.skills.some((s) => s.riskLevel === 'high')
    ) {
      nudges.push({
        id: 'mistakes',
        title: 'Repair a high-risk skill',
        body: 'You have a high-risk skill with no resolved repairs — clear it before it resurfaces.',
        link: '/app/mistakes',
        priority: 65,
      });
    }
    return nudges.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }
}
