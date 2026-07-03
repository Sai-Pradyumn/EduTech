import { Injectable } from '@nestjs/common';
import { CareerTarget, SkillLevel } from '../../common/enums';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { StudentProfileDocument } from '../student-profile/schemas/student-profile.schema';
import { RoadmapService } from '../roadmap/roadmap.service';
import { RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import { AssessmentService } from '../assessment/services/assessment.service';
import { ProjectsService } from '../projects/services/projects.service';
import { AgentSessionService } from '../agents/core/agent-session.service';

export interface ScoreCard {
  label: string;
  value: number;
  hint: string;
}
export interface RadarAxis {
  label: string;
  value: number;
  target: number;
}
export interface Weakness {
  topic: string;
  severity: number;
  note: string;
}
export interface TimelineItem {
  kind: 'quiz' | 'chat' | 'roadmap';
  label: string;
  detail?: string;
  at: string;
}
/** One contributing signal of a blended metric — the "why" behind the number. */
export interface MetricSignal {
  label: string;
  /** The signal's own 0–100 value. */
  value: number;
  /** Its weight in the blend. */
  weight: number;
  /** Rounded points it contributes (value × weight). */
  contribution: number;
}

export interface LearningIntelligence {
  hasData: boolean;
  headline: string;
  healthScore: number;
  readinessScore: number;
  /** Exact blend behind healthScore — full formula transparency. */
  healthWhy: MetricSignal[];
  /** Exact blend behind readinessScore. */
  readinessWhy: MetricSignal[];
  scores: ScoreCard[];
  radar: RadarAxis[];
  weaknesses: Weakness[];
  strengths: string[];
  momentum: {
    activeDays: number;
    streak: number;
    sessions: number;
    quizzes: number;
    attempts: number;
    projects: number;
  };
  trend: { label: string; score: number }[];
  timeline: TimelineItem[];
  recommendations: string[];
}

const SKILL_BASELINE: Record<SkillLevel, number> = {
  [SkillLevel.Beginner]: 35,
  [SkillLevel.Intermediate]: 55,
  [SkillLevel.Advanced]: 75,
};

const READINESS_TARGET: Record<CareerTarget, number> = {
  [CareerTarget.Internship]: 75,
  [CareerTarget.FullTime]: 85,
  [CareerTarget.Freelancing]: 80,
  [CareerTarget.Startup]: 80,
  [CareerTarget.HigherStudies]: 80,
  [CareerTarget.SkillImprovement]: 70,
};

/**
 * Learning-Intelligence engine — aggregates the signals the platform already produces
 * (profile, active roadmap, quiz attempts + per-topic mastery, agent activity) into a
 * cockpit: health & readiness scores, a skill radar, a weakness heatmap, momentum, a
 * recent-activity timeline and recommendations. Read-only; reuses module services so it
 * never duplicates persistence. Scores are transparent heuristic blends (documented).
 */
@Injectable()
export class LearningIntelligenceService {
  constructor(
    private readonly profiles: StudentProfileService,
    private readonly roadmaps: RoadmapService,
    private readonly assessment: AssessmentService,
    private readonly projects: ProjectsService,
    private readonly sessions: AgentSessionService,
  ) {}

  async overview(userId: string): Promise<LearningIntelligence> {
    const [
      profile,
      roadmap,
      stats,
      attempts,
      mastery,
      projectStats,
      sessionList,
    ] = await Promise.all([
      this.profiles.findByUser(userId),
      this.roadmaps.findActive(userId).catch(() => null),
      this.assessment.stats(userId),
      this.assessment.listAttempts(userId),
      this.assessment.topicMastery(userId),
      this.projects.stats(userId),
      this.sessions.listSessions(userId),
    ]);

    const roadmapProgress = roadmap?.progressPercentage ?? 0;
    const quizAvg = stats.averageScore;
    const hasQuiz = stats.attempts > 0;

    // ── activity / momentum ──────────────────────────────────────────────────
    const activityDates = [
      ...attempts.map((a) => a.createdAt),
      ...sessionList.map(
        (s) =>
          (
            s.lastMessageAt ?? (s as { updatedAt?: Date }).updatedAt
          )?.toISOString?.() ?? '',
      ),
    ].filter(Boolean);
    const activeDays = this.activeDays(activityDates, 14);
    const streak = this.streak(activityDates);
    const activityScore = Math.min(100, activeDays * 16); // ~6 active days in 2 weeks → 96

    // ── weaknesses (quiz topics + profile-flagged) ───────────────────────────
    const weaknesses = this.weaknesses(mastery, profile);
    const weakControl = weaknesses.length
      ? Math.round(
          100 -
            weaknesses.reduce((s, w) => s + w.severity, 0) / weaknesses.length,
        )
      : hasQuiz
        ? 90
        : 60;

    // ── radar + strengths ────────────────────────────────────────────────────
    const radar = this.radar(profile, roadmap, mastery);
    const strengths = mastery
      .filter((m) => m.mastery >= 80)
      .map((m) => this.titleCase(m.topic))
      .slice(0, 5);

    // ── scores ───────────────────────────────────────────────────────────────
    const healthScore = this.blend([
      [roadmapProgress, 0.3],
      [hasQuiz ? quizAvg : 50, 0.3],
      [activityScore, 0.2],
      [weakControl, 0.2],
    ]);
    const skillCoverage = radar.length
      ? Math.round(
          radar.reduce(
            (s, a) => s + Math.min(100, (a.value / a.target) * 100),
            0,
          ) / radar.length,
        )
      : SKILL_BASELINE[profile?.currentSkillLevel ?? SkillLevel.Beginner];
    // Project dimension: build-and-ship evidence (completed weighted over in-progress).
    const projectScore = projectStats.total
      ? Math.min(
          100,
          projectStats.completed * 50 + projectStats.avgProgress * 0.5,
        )
      : 0;
    const readinessScore = this.blend([
      [skillCoverage, 0.35],
      [hasQuiz ? quizAvg : 45, 0.25],
      [roadmapProgress, 0.2],
      [projectScore, 0.2],
    ]);

    const scores: ScoreCard[] = [
      {
        label: 'Roadmap progress',
        value: roadmapProgress,
        hint: roadmap
          ? `${roadmap.completedWeeks.length}/${roadmap.weeklyPlan.length} weeks`
          : 'No active roadmap',
      },
      {
        label: 'Quiz average',
        value: quizAvg,
        hint: `${stats.attempts} attempt${stats.attempts === 1 ? '' : 's'}`,
      },
      {
        label: 'Consistency',
        value: activityScore,
        hint: `${activeDays} active day${activeDays === 1 ? '' : 's'} / 14`,
      },
      {
        label: 'Weak-area control',
        value: weakControl,
        hint: weaknesses.length
          ? `${weaknesses.length} to improve`
          : 'No gaps flagged',
      },
    ];

    const trend = attempts
      .slice(0, 8)
      .reverse()
      .map((a, i) => ({ label: `#${i + 1}`, score: a.score }));

    // "Why" drill-downs — the exact blend inputs, so the numbers explain themselves.
    const signal = (
      label: string,
      value: number,
      weight: number,
    ): MetricSignal => ({
      label,
      value: Math.round(value),
      weight,
      contribution: Math.round(value * weight),
    });
    const healthWhy = [
      signal('Roadmap progress', roadmapProgress, 0.3),
      signal(
        hasQuiz ? 'Quiz average' : 'Quiz average (no attempts yet — neutral)',
        hasQuiz ? quizAvg : 50,
        0.3,
      ),
      signal('Consistency (active days / 14)', activityScore, 0.2),
      signal('Weak-area control', weakControl, 0.2),
    ];
    const readinessWhy = [
      signal('Skill coverage vs role target', skillCoverage, 0.35),
      signal(
        hasQuiz ? 'Quiz average' : 'Quiz average (no attempts yet — neutral)',
        hasQuiz ? quizAvg : 45,
        0.25,
      ),
      signal('Roadmap progress', roadmapProgress, 0.2),
      signal('Projects shipped', projectScore, 0.2),
    ];

    return {
      hasData: !!profile,
      headline: this.headline(profile, healthScore, readinessScore, weaknesses),
      healthScore,
      readinessScore,
      healthWhy,
      readinessWhy,
      scores,
      radar,
      weaknesses,
      strengths,
      momentum: {
        activeDays,
        streak,
        sessions: sessionList.length,
        quizzes: stats.quizzes,
        attempts: stats.attempts,
        projects: projectStats.total,
      },
      trend,
      timeline: this.timeline(attempts, sessionList, roadmap),
      recommendations: this.recommendations(
        profile,
        roadmap,
        weaknesses,
        stats.attempts,
        projectStats.total,
      ),
    };
  }

  // ── radar ─────────────────────────────────────────────────────────────────
  private radar(
    profile: StudentProfileDocument | null,
    roadmap: RoadmapDocument | null,
    mastery: { topic: string; mastery: number }[],
  ): RadarAxis[] {
    const target = profile ? READINESS_TARGET[profile.careerTarget] : 80;
    const baseline =
      SKILL_BASELINE[profile?.currentSkillLevel ?? SkillLevel.Beginner];
    const axes = new Map<string, number>();

    // Real quiz mastery first (strongest signal).
    for (const m of mastery.slice(0, 6))
      axes.set(this.titleCase(m.topic), m.mastery);

    // Fill from the student's stated skills (baseline) until we have ~6 axes.
    for (const skill of profile?.currentSkills ?? []) {
      if (axes.size >= 6) break;
      const key = this.titleCase(skill);
      if (!axes.has(key)) axes.set(key, baseline);
    }
    // Fill from roadmap week focuses if still sparse.
    for (const week of roadmap?.weeklyPlan ?? []) {
      if (axes.size >= 6) break;
      const key = this.titleCase((week.focus || '').split(/[:,–-]/)[0].trim());
      if (key && !axes.has(key))
        axes.set(key, Math.max(baseline, roadmap?.progressPercentage ?? 0));
    }
    return [...axes.entries()].map(([label, value]) => ({
      label: this.short(label),
      value,
      target,
    }));
  }

  // ── weaknesses ──────────────────────────────────────────────────────────────
  private weaknesses(
    mastery: { topic: string; mastery: number; answered: number }[],
    profile: StudentProfileDocument | null,
  ): Weakness[] {
    const out: Weakness[] = [];
    const seen = new Set<string>();
    for (const m of mastery) {
      if (m.mastery < 60) {
        out.push({
          topic: this.titleCase(m.topic),
          severity: 100 - m.mastery,
          note: `Quiz mastery ${m.mastery}%`,
        });
        seen.add(m.topic.toLowerCase());
      }
    }
    for (const w of profile?.weakAreas ?? []) {
      if (!seen.has(w.toLowerCase())) {
        out.push({ topic: w, severity: 55, note: 'Flagged in your profile' });
      }
    }
    return out.sort((a, b) => b.severity - a.severity).slice(0, 8);
  }

  // ── timeline ──────────────────────────────────────────────────────────────
  private timeline(
    attempts: { quizId: string; score: number; createdAt: string }[],
    sessions: { title: string; agentType: string; lastMessageAt?: Date }[],
    roadmap: RoadmapDocument | null,
  ): TimelineItem[] {
    const items: TimelineItem[] = [];
    for (const a of attempts.slice(0, 6)) {
      items.push({
        kind: 'quiz',
        label: `Scored ${a.score}% on a quiz`,
        at: a.createdAt,
      });
    }
    for (const s of sessions.slice(0, 6)) {
      const at = s.lastMessageAt ? new Date(s.lastMessageAt).toISOString() : '';
      if (at)
        items.push({
          kind: 'chat',
          label: s.title || 'AI session',
          detail: s.agentType,
          at,
        });
    }
    if (roadmap) {
      items.push({
        kind: 'roadmap',
        label: `${roadmap.completedWeeks.length} week(s) completed`,
        detail: roadmap.title,
        at: '',
      });
    }
    return items
      .filter((i) => i.at)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 8);
  }

  // ── recommendations ──────────────────────────────────────────────────────────
  private recommendations(
    profile: StudentProfileDocument | null,
    roadmap: RoadmapDocument | null,
    weaknesses: Weakness[],
    attempts: number,
    projects: number,
  ): string[] {
    const recs: string[] = [];
    if (weaknesses[0])
      recs.push(
        `Drill your weakest area: ${weaknesses[0].topic} (take a weak-area quiz).`,
      );
    if (attempts === 0)
      recs.push('Take your first quiz to calibrate your skill map.');
    if (projects === 0)
      recs.push(
        'Build a portfolio project in the Project Studio to lift readiness.',
      );
    if (roadmap) {
      const nextWeek = roadmap.weeklyPlan.find(
        (w) => !roadmap.completedWeeks.includes(w.weekNumber),
      );
      if (nextWeek)
        recs.push(
          `Continue your roadmap: Week ${nextWeek.weekNumber} — ${nextWeek.focus}.`,
        );
    } else if (profile) {
      recs.push('Generate a roadmap to structure your learning.');
    }
    if (recs.length < 3)
      recs.push('Ask the AI Tutor to explain a concept you find shaky.');
    return recs.slice(0, 4);
  }

  // ── scoring helpers ──────────────────────────────────────────────────────────
  private blend(parts: [number, number][]): number {
    const total = parts.reduce(
      (s, [v, w]) => s + Math.max(0, Math.min(100, v)) * w,
      0,
    );
    return Math.round(total);
  }

  private activeDays(dates: string[], window: number): number {
    const now = Date.now();
    const cutoff = now - window * 24 * 3600 * 1000;
    const days = new Set<string>();
    for (const d of dates) {
      const t = new Date(d).getTime();
      if (!Number.isNaN(t) && t >= cutoff)
        days.add(new Date(d).toISOString().slice(0, 10));
    }
    return days.size;
  }

  private streak(dates: string[]): number {
    const days = new Set(
      dates
        .map((d) => new Date(d).toISOString().slice(0, 10))
        .filter((s) => s.length === 10),
    );
    let streak = 0;
    const cursor = new Date();
    for (;;) {
      const key = cursor.toISOString().slice(0, 10);
      if (days.has(key)) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else if (
        streak === 0 &&
        key === new Date().toISOString().slice(0, 10)
      ) {
        // allow today to be empty without breaking a prior streak
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else break;
    }
    return streak;
  }

  private headline(
    profile: StudentProfileDocument | null,
    health: number,
    readiness: number,
    weaknesses: Weakness[],
  ): string {
    if (!profile)
      return 'Complete onboarding to unlock your learning intelligence.';
    const name = profile.fullName?.split(' ')[0] ?? 'there';
    const band =
      health >= 75
        ? 'on a strong trajectory'
        : health >= 50
          ? 'making steady progress'
          : 'just getting started';
    const focus = weaknesses[0] ? ` Next focus: ${weaknesses[0].topic}.` : '';
    return `${name}, you're ${band} — learning health ${health}%, career readiness ${readiness}%.${focus}`;
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  private short(s: string): string {
    return s.length > 16 ? `${s.slice(0, 15)}…` : s;
  }
}
