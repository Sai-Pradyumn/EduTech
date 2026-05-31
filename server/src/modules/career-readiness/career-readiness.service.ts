import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SkillTwinService, SkillTwin } from '../skill-twin/skill-twin.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProjectsService } from '../projects/services/projects.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import {
  CAREER_ROLES,
  CareerRole,
  findRole,
  matchRoleFromGoal,
  RequiredSkill,
} from './career-roles';
import {
  CareerReadinessState,
  CareerReadinessStateDocument,
} from './schemas/career-readiness.schema';
import { CareerReadinessAgent } from './career-readiness.agent';

export interface SkillGap {
  skill: string;
  current: number;
  target: number;
  gap: number;
  met: boolean;
}

export interface ReadinessDimension {
  key: 'skills' | 'projects' | 'interview' | 'consistency' | 'portfolio';
  label: string;
  score: number;
  weight: number;
  /** Evidence supporting this score. */
  supports: string[];
  /** What is missing. */
  missing: string[];
  /** Single fastest action to raise it. */
  fastestAction: string;
}

export interface PlanItem {
  day: number;
  title: string;
  reason: string;
  route: string;
  kind:
    | 'flow'
    | 'quiz'
    | 'project'
    | 'simulation'
    | 'interview'
    | 'mistake'
    | 'visual';
}

export interface ReadinessAnalysis {
  role: { id: string; title: string; level: string; summary: string };
  readinessScore: number;
  band: 'early' | 'building' | 'close' | 'ready';
  dimensions: ReadinessDimension[];
  skillGaps: SkillGap[];
  projectGap: { have: number; need: number; note: string; met: boolean };
  interviewGap: { score: number; expectations: string[]; met: boolean };
  portfolioChecklist: { item: string; done: boolean }[];
  blockers: { title: string; impact: string }[];
  weekPlan: PlanItem[];
  recommendations: {
    flows: string[];
    quizzes: string[];
    projects: string[];
    simulations: string[];
  };
  explanation: string;
  lastAnalyzedAt: string;
}

/**
 * Phase 9 · Career Readiness Engine — maps the learner's Skill Twin + Proof Ledger + projects
 * against a target-role rubric to produce an explainable readiness score, skill/project/interview
 * gaps, top blockers and a concrete 7-day plan. Deterministic + offline-safe; the agent adds a
 * human-language explanation on top (with a deterministic fallback).
 */
@Injectable()
export class CareerReadinessService {
  constructor(
    @InjectModel(CareerReadinessState.name)
    private readonly stateModel: Model<CareerReadinessStateDocument>,
    private readonly twin: SkillTwinService,
    private readonly ledger: LedgerService,
    private readonly projects: ProjectsService,
    private readonly profiles: StudentProfileService,
    private readonly agent: CareerReadinessAgent,
  ) {}

  listRoles() {
    return CAREER_ROLES.map((r) => ({
      id: r.id,
      title: r.title,
      level: r.level,
      summary: r.summary,
      requiredSkills: r.requiredSkills.map((s) => s.name),
    }));
  }

  async getState(userId: string): Promise<CareerReadinessStateDocument> {
    const existing = await this.stateModel
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
    if (existing) return existing;
    const profile = await this.profiles.findByUser(userId);
    const role = matchRoleFromGoal(profile?.mainGoal ?? '');
    return this.stateModel.create({
      user: new Types.ObjectId(userId),
      targetRoleId: role.id,
    });
  }

  async setTargetRole(
    userId: string,
    roleId: string,
  ): Promise<ReadinessAnalysis> {
    const role = findRole(roleId);
    const state = await this.getState(userId);
    state.targetRoleId = role ? role.id : state.targetRoleId;
    await state.save();
    return this.analyze(userId);
  }

  async getMe(userId: string): Promise<ReadinessAnalysis> {
    return this.analyze(userId);
  }

  async analyze(userId: string): Promise<ReadinessAnalysis> {
    const state = await this.getState(userId);
    const role = findRole(state.targetRoleId) ?? CAREER_ROLES[0];
    const [twin, summary, projects, ledgerEntries] = await Promise.all([
      this.twin.compute(userId),
      this.ledger.summary(userId),
      this.projects.list(userId),
      this.ledger.list(userId, 200),
    ]);

    // ── skills dimension (radar mastery blended with proven ledger evidence) ──
    const ledgerSkillScore = this.ledgerSkillScores(ledgerEntries);
    const masteryFor = this.masteryLookup(twin, ledgerSkillScore);
    const skillGaps: SkillGap[] = role.requiredSkills.map((rs) => {
      const current = masteryFor(rs.name);
      return {
        skill: rs.name,
        current,
        target: rs.target,
        gap: Math.max(0, rs.target - current),
        met: current >= rs.target,
      };
    });
    const skillsScore = this.weightedSkillScore(
      role.requiredSkills,
      masteryFor,
    );

    // ── projects dimension ──
    const completed = projects.filter((p) => p.status === 'completed').length;
    const reviewed = projects.filter((p) => p.aiReview?.overallScore);
    const avgReview = reviewed.length
      ? Math.round(
          reviewed.reduce((s, p) => s + (p.aiReview?.overallScore ?? 0), 0) /
            reviewed.length,
        )
      : 0;
    const coverage = Math.min(
      1,
      completed / Math.max(1, role.projectExpectations.minProjects),
    );
    const quality = avgReview ? avgReview / 100 : projects.length ? 0.55 : 0;
    const projectsScore = clamp(
      Math.round((coverage * 0.6 + quality * 0.4) * 100),
    );

    // ── interview dimension ──
    const interviewScore = this.interviewScoreFrom(ledgerEntries);

    // ── consistency dimension (inverse of retention risk) ──
    const consistencyScore = clamp(100 - twin.retentionRisk);

    // ── portfolio dimension ──
    const hasDemo = projects.some((p) => p.submission?.demoUrl);
    const hasRepo = projects.some((p) => p.submission?.githubUrl);
    const certs =
      summary.byKind.find((b) => b.kind === 'certificate_earned')?.count ?? 0;
    const portfolioScore = clamp(
      (completed >= 1 ? 30 : 0) +
        (hasDemo ? 25 : 0) +
        (hasRepo ? 20 : 0) +
        Math.min(25, certs * 12),
    );

    const dims: Record<ReadinessDimension['key'], number> = {
      skills: skillsScore,
      projects: projectsScore,
      interview: interviewScore,
      consistency: consistencyScore,
      portfolio: portfolioScore,
    };
    const r = role.readinessRubric;
    const readinessScore = clamp(
      Math.round(
        dims.skills * r.skills +
          dims.projects * r.projects +
          dims.interview * r.interview +
          dims.consistency * r.consistency +
          dims.portfolio * r.portfolio,
      ),
    );

    const dimensions = this.buildDimensions(
      role,
      dims,
      skillGaps,
      completed,
      avgReview,
      interviewScore,
      twin,
      hasDemo,
      hasRepo,
      certs,
    );

    // ── gaps / blockers / plan ──
    const sortedGaps = [...skillGaps]
      .filter((g) => !g.met)
      .sort((a, b) => b.gap - a.gap);
    const projectGap = {
      have: completed,
      need: role.projectExpectations.minProjects,
      note: role.projectExpectations.note,
      met: completed >= role.projectExpectations.minProjects,
    };
    const interviewGap = {
      score: interviewScore,
      expectations: role.interviewExpectations,
      met: interviewScore >= 60,
    };
    const portfolioChecklist = [
      {
        item: `${role.projectExpectations.minProjects}+ completed projects`,
        done: projectGap.met,
      },
      { item: 'A deployed / live demo', done: hasDemo },
      { item: 'Public GitHub repos', done: hasRepo },
      { item: 'Skill Passport published', done: false },
      { item: 'A certificate of proof', done: certs > 0 },
    ];

    const blockers = this.blockers(sortedGaps, projectGap, interviewGap, twin);
    const weekPlan = this.weekPlan(sortedGaps, projectGap, interviewGap, twin);
    const recommendations = {
      flows: sortedGaps.slice(0, 2).map((g) => `Targeted flow: ${g.skill}`),
      quizzes: sortedGaps.slice(0, 2).map((g) => `Quiz: ${g.skill}`),
      projects: projectGap.met ? [] : [role.projectExpectations.note],
      simulations: interviewGap.met ? [] : [`Mock ${role.title} interview`],
    };

    const band: ReadinessAnalysis['band'] =
      readinessScore >= 82
        ? 'ready'
        : readinessScore >= 65
          ? 'close'
          : readinessScore >= 45
            ? 'building'
            : 'early';

    const explanation = await this.agent.explain(userId, {
      role,
      readinessScore,
      band,
      dimensions,
      topGaps: sortedGaps.slice(0, 3),
      projectGap,
      interviewGap,
    });

    // cache score
    state.lastScore = readinessScore;
    state.lastAnalyzedAt = new Date();
    await state.save();

    return {
      role: {
        id: role.id,
        title: role.title,
        level: role.level,
        summary: role.summary,
      },
      readinessScore,
      band,
      dimensions,
      skillGaps,
      projectGap,
      interviewGap,
      portfolioChecklist,
      blockers,
      weekPlan,
      recommendations,
      explanation,
      lastAnalyzedAt: state.lastAnalyzedAt.toISOString(),
    };
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Average score per skill from scored ledger evidence (quizzes, reviews, vivas, sims). */
  private ledgerSkillScores(
    entries: { skills?: string[]; score?: number; kind: string }[],
  ): Map<string, number> {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const e of entries) {
      if (typeof e.score !== 'number' || e.kind === 'quiz_failed') continue;
      for (const sk of e.skills ?? []) {
        const key = sk.toLowerCase();
        const cur = acc.get(key) ?? { sum: 0, n: 0 };
        cur.sum += e.score;
        cur.n += 1;
        acc.set(key, cur);
      }
    }
    const out = new Map<string, number>();
    acc.forEach((v, k) => out.set(k, Math.round(v.sum / v.n)));
    return out;
  }

  /** Best mastery for a role skill: the higher of radar mastery and proven ledger evidence. */
  private masteryLookup(
    twin: SkillTwin,
    ledgerScore: Map<string, number>,
  ): (name: string) => number {
    const map = twin.skills.map((s) => ({
      key: s.skill.toLowerCase(),
      mastery: s.mastery,
    }));
    const ledger = [...ledgerScore.entries()];
    const match = (n: string, key: string) =>
      key === n || key.includes(n) || n.includes(key);
    return (name: string) => {
      const n = name.toLowerCase();
      const radar = map.find((m) => match(n, m.key))?.mastery ?? 0;
      const proven = ledger.find(([k]) => match(n, k))?.[1] ?? 0;
      return Math.max(radar, proven);
    };
  }

  private weightedSkillScore(
    required: RequiredSkill[],
    masteryFor: (n: string) => number,
  ): number {
    const totalW = required.reduce((s, r) => s + r.weight, 0) || 1;
    const sum = required.reduce((s, rs) => {
      const ratio = Math.min(100, (masteryFor(rs.name) / rs.target) * 100);
      return s + ratio * rs.weight;
    }, 0);
    return clamp(Math.round(sum / totalW));
  }

  /** Average score of interview/simulation/viva ledger events; 0 when none. */
  private interviewScoreFrom(
    entries: { kind: string; score?: number }[],
  ): number {
    const scored = entries.filter(
      (e) =>
        [
          'simulation_finished',
          'interview_completed',
          'interview_passed',
          'voice_viva_passed',
        ].includes(e.kind) && typeof e.score === 'number',
    );
    if (!scored.length) return 0;
    return clamp(
      Math.round(
        scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length,
      ),
    );
  }

  private buildDimensions(
    role: CareerRole,
    dims: Record<ReadinessDimension['key'], number>,
    skillGaps: SkillGap[],
    completed: number,
    avgReview: number,
    interviewScore: number,
    twin: SkillTwin,
    hasDemo: boolean,
    hasRepo: boolean,
    certs: number,
  ): ReadinessDimension[] {
    const r = role.readinessRubric;
    const met = skillGaps.filter((g) => g.met).map((g) => g.skill);
    const unmet = skillGaps.filter((g) => !g.met).sort((a, b) => b.gap - a.gap);
    return [
      {
        key: 'skills',
        label: 'Core skills',
        score: dims.skills,
        weight: r.skills,
        supports: met.length
          ? [`At target on ${met.slice(0, 4).join(', ')}`]
          : ['Some foundations in place'],
        missing: unmet
          .slice(0, 3)
          .map((g) => `${g.skill}: ${g.current}/${g.target}`),
        fastestAction: unmet[0]
          ? `Drill ${unmet[0].skill} — the biggest single skill gap.`
          : 'Keep all skills above target.',
      },
      {
        key: 'projects',
        label: 'Project evidence',
        score: dims.projects,
        weight: r.projects,
        supports: completed
          ? [
              `${completed} completed project${completed > 1 ? 's' : ''}${avgReview ? `, avg review ${avgReview}/100` : ''}`,
            ]
          : [],
        missing:
          completed >= role.projectExpectations.minProjects
            ? []
            : [
                `Need ${role.projectExpectations.minProjects - completed} more strong project(s)`,
              ],
        fastestAction:
          completed >= role.projectExpectations.minProjects
            ? 'Polish a project and request a review.'
            : 'Build a role-relevant project and submit it for review.',
      },
      {
        key: 'interview',
        label: 'Interview readiness',
        score: dims.interview,
        weight: r.interview,
        supports: interviewScore
          ? [`Mock-interview score ${interviewScore}/100`]
          : [],
        missing:
          interviewScore >= 60 ? [] : ['No strong mock-interview evidence yet'],
        fastestAction:
          interviewScore >= 60
            ? 'Run a harder mock to stretch your ceiling.'
            : 'Run a mock interview for this role to get a baseline.',
      },
      {
        key: 'consistency',
        label: 'Consistency',
        score: dims.consistency,
        weight: r.consistency,
        supports: twin.retentionRisk < 40 ? ['Steady, recent activity'] : [],
        missing:
          twin.retentionRisk >= 40
            ? ['Activity has dipped — retention risk is rising']
            : [],
        fastestAction: 'Complete your daily plan a few days in a row.',
      },
      {
        key: 'portfolio',
        label: 'Portfolio',
        score: dims.portfolio,
        weight: r.portfolio,
        supports: [
          hasRepo ? 'Has public repos' : '',
          hasDemo ? 'Has a live demo' : '',
          certs ? `${certs} certificate(s)` : '',
        ].filter(Boolean),
        missing: [
          !hasDemo ? 'No live demo yet' : '',
          !hasRepo ? 'No public repo linked' : '',
        ].filter(Boolean),
        fastestAction: !hasDemo
          ? 'Deploy one project and add the demo link.'
          : 'Publish your Skill Passport / portfolio.',
      },
    ];
  }

  private blockers(
    gaps: SkillGap[],
    projectGap: { met: boolean; need: number; have: number },
    interviewGap: { met: boolean },
    twin: SkillTwin,
  ): { title: string; impact: string }[] {
    const out: { title: string; impact: string }[] = [];
    if (gaps[0])
      out.push({
        title: `Skill gap: ${gaps[0].skill}`,
        impact: `${gaps[0].current}/${gaps[0].target} — closing this lifts your skills score most.`,
      });
    if (!projectGap.met)
      out.push({
        title: 'Not enough project proof',
        impact: `${projectGap.have}/${projectGap.need} role-relevant projects — recruiters look for this first.`,
      });
    if (!interviewGap.met)
      out.push({
        title: 'Untested in interviews',
        impact:
          'No strong mock-interview evidence — a low ceiling here blocks offers.',
      });
    if (out.length < 3 && twin.weaknessRoots[0])
      out.push({
        title: `Open weakness: ${twin.weaknessRoots[0].concept}`,
        impact: 'A recurring gap that keeps resurfacing in your work.',
      });
    if (out.length < 3 && gaps[1])
      out.push({
        title: `Skill gap: ${gaps[1].skill}`,
        impact: `${gaps[1].current}/${gaps[1].target} — your second-biggest lever.`,
      });
    return out.slice(0, 3);
  }

  private weekPlan(
    gaps: SkillGap[],
    projectGap: { met: boolean },
    interviewGap: { met: boolean },
    twin: SkillTwin,
  ): PlanItem[] {
    const plan: PlanItem[] = [];
    let day = 1;
    if (twin.weaknessRoots[0])
      plan.push({
        day: day++,
        title: `Repair "${twin.weaknessRoots[0].concept}"`,
        reason: 'Clear your highest-severity open gap first.',
        route: '/app/mistakes',
        kind: 'mistake',
      });
    if (gaps[0])
      plan.push({
        day: day++,
        title: `Learn ${gaps[0].skill}`,
        reason: `Biggest skill gap (${gaps[0].current}/${gaps[0].target}).`,
        route: '/app/flows',
        kind: 'flow',
      });
    if (gaps[0])
      plan.push({
        day: day++,
        title: `Quiz yourself on ${gaps[0].skill}`,
        reason: 'Lock in what you just studied with active recall.',
        route: '/app/quizzes',
        kind: 'quiz',
      });
    if (gaps[1])
      plan.push({
        day: day++,
        title: `Learn ${gaps[1].skill}`,
        reason: `Second-biggest skill gap (${gaps[1].current}/${gaps[1].target}).`,
        route: '/app/flows',
        kind: 'flow',
      });
    if (!projectGap.met)
      plan.push({
        day: day++,
        title: 'Build a role-relevant project',
        reason: 'Project proof is what recruiters scan for first.',
        route: '/app/projects',
        kind: 'project',
      });
    if (!interviewGap.met)
      plan.push({
        day: day++,
        title: 'Run a mock interview',
        reason: 'Get a baseline interview score for this role.',
        route: '/app/interview',
        kind: 'interview',
      });
    while (plan.length < 7) {
      plan.push({
        day: day++,
        title: 'Advance your active flow',
        reason: 'Keep momentum toward your goal.',
        route: '/app/flows',
        kind: 'flow',
      });
    }
    return plan.slice(0, 7);
  }
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
