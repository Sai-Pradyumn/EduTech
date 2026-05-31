import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SkillTwinService } from '../skill-twin/skill-twin.service';
import { CareerReadinessService, ReadinessAnalysis } from '../career-readiness/career-readiness.service';
import { CouncilRecommendation, CouncilRecommendationDocument } from './schemas/council-recommendation.schema';
import { OutcomeCouncilAgent } from './outcome-council.agent';
import { CouncilAction, CouncilResult } from './outcome-council.types';

/**
 * Phase 9 · AI Outcome Council — several specialist perspectives (Skill Twin, Career Readiness,
 * Project Reviewer, Interview Coach, Portfolio, Consistency) each propose a next action grounded in
 * the learner's data. The service ranks them by real-world impact, then an agent narrates the verdict.
 * Explainable, deterministic ranking; LLM only narrates (with fallback).
 */
@Injectable()
export class OutcomeCouncilService {
  constructor(
    @InjectModel(CouncilRecommendation.name) private readonly model: Model<CouncilRecommendationDocument>,
    private readonly twin: SkillTwinService,
    private readonly readiness: CareerReadinessService,
    private readonly agent: OutcomeCouncilAgent,
  ) {}

  async recommend(userId: string): Promise<CouncilResult> {
    const [analysis, twin] = await Promise.all([this.readiness.analyze(userId), this.twin.compute(userId)]);
    const candidates = this.gather(analysis, twin);
    candidates.sort((a, b) => b.expectedImpact - a.expectedImpact);
    const best = candidates[0] ?? null;
    const alternatives = candidates.slice(1, 4);

    const verdict = best
      ? await this.agent.verdict(userId, analysis.role.title, analysis.readinessScore, best, alternatives)
      : 'Your proof is in great shape — keep advancing your active flow and publish your passport.';

    const context = { role: analysis.role.title, readinessScore: analysis.readinessScore, band: analysis.band };
    await this.model.create({ user: new Types.ObjectId(userId), verdict, best: best ?? undefined, alternatives, context });

    return { verdict, best, alternatives, context, generatedAt: new Date().toISOString() };
  }

  async latest(userId: string): Promise<CouncilResult | null> {
    const doc = await this.model.findOne({ user: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
    if (!doc) return null;
    return {
      verdict: doc.verdict,
      best: (doc.best as unknown as CouncilAction) ?? null,
      alternatives: (doc.alternatives as unknown as CouncilAction[]) ?? [],
      context: (doc.context as { role: string; readinessScore: number; band: string }) ?? { role: '', readinessScore: 0, band: 'early' },
      generatedAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /** Each council member proposes one grounded action (or abstains). */
  private gather(a: ReadinessAnalysis, twin: { weaknessRoots: { concept: string; severity: number }[]; retentionRisk: number }): CouncilAction[] {
    const out: CouncilAction[] = [];
    const dim = (k: string) => a.dimensions.find((d) => d.key === k)?.score ?? 0;
    const topGap = a.skillGaps.filter((g) => !g.met).sort((x, y) => y.gap - x.gap)[0];

    // Skill Twin — repair the highest-severity open weakness.
    if (twin.weaknessRoots[0]) {
      const w = twin.weaknessRoots[0];
      out.push({
        id: 'twin', agent: 'Skill Twin',
        action: `Repair your weakest concept: ${w.concept}`,
        why: `It keeps resurfacing (severity ${w.severity}/100) and quietly drags every related skill down.`,
        expectedImpact: clamp(40 + Math.round(w.severity * 0.4)),
        timeRequired: '30–45 min', route: '/app/mistakes',
        riskIfIgnored: 'The gap compounds and shows up again in interviews.',
      });
    }

    // Career Readiness — close the biggest skill gap.
    if (topGap) {
      out.push({
        id: 'career', agent: 'Career Readiness',
        action: `Close your biggest skill gap: ${topGap.skill}`,
        why: `You're at ${topGap.current}/${topGap.target} for ${a.role.title} — this is your largest single lever.`,
        expectedImpact: clamp(45 + Math.round(topGap.gap * 0.45) - Math.round(a.dimensions.find((d) => d.key === 'skills')!.score * 0.1)),
        timeRequired: '2–4 hrs', route: '/app/flows',
        riskIfIgnored: 'You stay below the bar recruiters screen for.',
      });
    }

    // Project Reviewer — build/submit project proof when thin.
    if (!a.projectGap.met) {
      out.push({
        id: 'project', agent: 'Project Reviewer',
        action: 'Build a role-relevant project and submit it for review',
        why: `You have ${a.projectGap.have}/${a.projectGap.need} strong projects — project proof is what recruiters scan first.`,
        expectedImpact: clamp(70 - dim('projects')),
        timeRequired: '1–2 weeks', route: '/app/projects',
        riskIfIgnored: 'Your application looks all-theory, no shipped work.',
      });
    }

    // Interview Coach — get a baseline / raise the ceiling.
    if (!a.interviewGap.met) {
      out.push({
        id: 'interview', agent: 'Interview Coach',
        action: 'Run a mock interview for your target role',
        why: a.interviewGap.score ? `Your interview score is ${a.interviewGap.score}/100 — push it higher.` : 'You have no interview evidence yet — get a baseline.',
        expectedImpact: clamp(60 - Math.round(a.interviewGap.score * 0.4)),
        timeRequired: '30 min', route: '/app/interview',
        riskIfIgnored: 'A strong resume can still fail at the interview round.',
      });
    }

    // Portfolio — publish + add a live demo.
    if (dim('portfolio') < 60) {
      out.push({
        id: 'portfolio', agent: 'Portfolio Builder',
        action: 'Publish your Skill Passport and add a live demo',
        why: 'Proof recruiters can verify in one click beats a list of claims.',
        expectedImpact: clamp(50 - Math.round(dim('portfolio') * 0.3)),
        timeRequired: '20–40 min', route: '/app/skill-passport',
        riskIfIgnored: 'Your verified work stays invisible to recruiters.',
      });
    }

    // Consistency — protect the streak when retention risk is high.
    if (twin.retentionRisk >= 45) {
      out.push({
        id: 'consistency', agent: 'Consistency Coach',
        action: 'Complete today\'s plan to rebuild momentum',
        why: `Your retention risk is ${twin.retentionRisk}/100 — a short daily streak re-warms what you know.`,
        expectedImpact: clamp(30 + Math.round(twin.retentionRisk * 0.3)),
        timeRequired: '15–30 min', route: '/app/today',
        riskIfIgnored: 'You forget faster than you learn and lose progress.',
      });
    }

    return out;
  }
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
