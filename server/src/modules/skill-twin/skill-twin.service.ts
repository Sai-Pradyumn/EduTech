import { Injectable } from '@nestjs/common';
import { LearningIntelligenceService } from '../learning-intelligence/learning-intelligence.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { FlowsService } from '../flows/flows.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import {
  MistakeDocument,
  MistakeType,
} from '../mistakes/schemas/mistake.schema';

export type Modality =
  | 'read'
  | 'voice'
  | 'quiz'
  | 'project'
  | 'visual'
  | 'mentor'
  | 'simulation';

export interface TwinAction {
  id: string;
  label: string;
  /** The "why Asta recommends this" explanation. */
  reason: string;
  route: string;
  modality: Modality;
  kind: 'repair' | 'flow' | 'quiz' | 'project' | 'visual' | 'voice' | 'explore';
}

export interface SkillTwin {
  hasData: boolean;
  headline: string;
  readinessScore: number;
  healthScore: number;
  retentionRisk: number; // 0–100, higher = more likely to forget / disengage
  burnoutRisk: number; // 0–100
  pace: 'behind' | 'steady' | 'ahead';
  projectedDaysToGoal: number | null;
  preferredModality: Modality;
  modality: { modality: Modality; reason: string };
  skills: { skill: string; mastery: number; target: number }[];
  strengths: string[];
  weaknessRoots: {
    concept: string;
    severity: number;
    frequency: number;
    source: string;
    status: string;
  }[];
  misconceptionMemory: {
    concept: string;
    type: MistakeType;
    frequency: number;
  }[];
  nextBestActions: TwinAction[];
  signals: { label: string; detail: string }[];
}

const LEARNING_STYLE_MODALITY: Record<string, Modality> = {
  video: 'read',
  reading: 'read',
  project: 'project',
  practice: 'quiz',
  mixed: 'read',
};

/**
 * Skill Twin — a live, explainable model of the learner. It does NOT own persistence; it blends the
 * signals the platform already produces (Learning-Intelligence overview, Mistake OS, the active flow,
 * the profile) into readiness/retention/pace, a mastery graph, misconception memory, an adaptive
 * modality recommendation and a set of next-best-actions that each carry a "why".
 */
@Injectable()
export class SkillTwinService {
  constructor(
    private readonly li: LearningIntelligenceService,
    private readonly mistakes: MistakesService,
    private readonly flows: FlowsService,
    private readonly profiles: StudentProfileService,
  ) {}

  async compute(userId: string): Promise<SkillTwin> {
    const [overview, allMistakes, profile, activeFlow] = await Promise.all([
      this.li.overview(userId),
      this.mistakes.list(userId),
      this.profiles.findByUser(userId),
      this.flows.findActive(userId),
    ]);

    const openMistakes = allMistakes.filter(
      (m) => m.status === 'open' || m.status === 'repairing',
    );
    const sortedOpen = [...openMistakes].sort(
      (a, b) => b.severity - a.severity,
    );

    // ── risk scores (transparent heuristics) ──
    const { activeDays, streak } = overview.momentum;
    const retentionRisk = clamp(
      Math.round(
        100 -
          (Math.min(activeDays, 14) / 14) * 70 -
          (Math.min(streak, 7) / 7) * 30,
      ),
    );
    // Burnout = SUSTAINED intensity: per-day load weighted by streak length (a single busy day isn't burnout).
    const load =
      (overview.momentum.attempts + overview.momentum.sessions) /
      Math.max(activeDays, 1);
    const burnoutRisk = clamp(
      Math.round(
        (Math.min(load, 8) / 8) * 55 + (Math.min(streak, 14) / 14) * 45,
      ),
    );

    // ── pace + projection ──
    const readiness = overview.readinessScore;
    const pace: SkillTwin['pace'] =
      readiness >= 75 ? 'ahead' : readiness >= 52 ? 'steady' : 'behind';
    const gap = Math.max(0, 80 - readiness);
    const factor = pace === 'ahead' ? 1.6 : pace === 'steady' ? 3 : 5;
    const projectedDaysToGoal = overview.hasData
      ? Math.round(gap * factor)
      : null;

    // ── modality router ──
    const preferredModality =
      LEARNING_STYLE_MODALITY[profile?.preferredLearningStyle ?? 'mixed'] ??
      'read';
    const modality = this.routeModality(
      sortedOpen,
      retentionRisk,
      activeFlow,
      preferredModality,
    );

    // ── mastery graph + misconception memory ──
    const skills = overview.radar.map((r) => ({
      skill: r.label,
      mastery: r.value,
      target: r.target,
    }));
    const weaknessRoots = sortedOpen.slice(0, 8).map((m) => ({
      concept: m.concept,
      severity: m.severity,
      frequency: m.frequency,
      source: m.source,
      status: m.status,
    }));
    const misconceptionMemory = sortedOpen.slice(0, 8).map((m) => ({
      concept: m.concept,
      type: m.mistakeType,
      frequency: m.frequency,
    }));

    const nextBestActions = this.nextActions(
      sortedOpen,
      overview,
      activeFlow,
      modality,
    );

    const signals: SkillTwin['signals'] = [
      {
        label: 'Quizzes',
        detail: `${overview.momentum.attempts} attempts · ${overview.momentum.quizzes} quizzes`,
      },
      {
        label: 'Open mistakes',
        detail: `${openMistakes.length} unresolved (${sortedOpen[0]?.concept ?? 'none'})`,
      },
      {
        label: 'Active flow',
        detail: activeFlow
          ? `${activeFlow.progressPercentage}% · ${activeFlow.title}`
          : 'none',
      },
      {
        label: 'Activity',
        detail: `${activeDays} active days · streak ${streak}`,
      },
      {
        label: 'Projects',
        detail: `${overview.momentum.projects} in progress/done`,
      },
    ];

    return {
      hasData: overview.hasData,
      headline: this.headline(pace, sortedOpen, modality),
      readinessScore: readiness,
      healthScore: overview.healthScore,
      retentionRisk,
      burnoutRisk,
      pace,
      projectedDaysToGoal,
      preferredModality,
      modality,
      skills,
      strengths: overview.strengths,
      weaknessRoots,
      misconceptionMemory,
      nextBestActions,
      signals,
    };
  }

  /** Adaptive Modality Router: choose how the learner should study next, with a reason. */
  private routeModality(
    open: MistakeDocument[],
    retentionRisk: number,
    activeFlow: { progressPercentage: number } | null,
    preferred: Modality,
  ): { modality: Modality; reason: string } {
    if (open.length) {
      const tally = new Map<MistakeType, number>();
      open.forEach((m) =>
        tally.set(m.mistakeType, (tally.get(m.mistakeType) ?? 0) + 1),
      );
      const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      switch (top) {
        case 'misconception':
        case 'missing_prerequisite':
          return {
            modality: 'visual',
            reason: `You hold ${tally.get(top)} misconception-type gaps — a diagram rebuilds the mental model faster than text.`,
          };
        case 'weak_recall':
          return {
            modality: 'quiz',
            reason:
              'Your gaps are recall-based — short spaced quizzes lock them in.',
          };
        case 'poor_explanation':
        case 'interview_communication_gap':
          return {
            modality: 'voice',
            reason:
              'You can do it but struggle to explain it — a spoken viva is the fastest fix.',
          };
        case 'implementation_gap':
        case 'project_architecture_gap':
          return {
            modality: 'project',
            reason:
              'Your gaps are in building, not theory — a small targeted project closes them.',
          };
        default:
          return {
            modality: preferred,
            reason: 'Matched to your preferred learning style.',
          };
      }
    }
    if (retentionRisk >= 60)
      return {
        modality: 'read',
        reason:
          'You have been away — a light revision pass re-warms what you knew.',
      };
    if (activeFlow)
      return {
        modality: preferred,
        reason:
          'No open gaps — keep advancing your active flow in your preferred style.',
      };
    return {
      modality: preferred,
      reason: 'Matched to your preferred learning style.',
    };
  }

  private nextActions(
    open: MistakeDocument[],
    overview: {
      readinessScore: number;
      weaknesses: { topic: string; severity: number }[];
      momentum: { projects: number };
    },
    activeFlow: {
      _id: unknown;
      title: string;
      goal: string;
      nodes: { id: string; title: string; status: string }[];
    } | null,
    modality: { modality: Modality },
  ): TwinAction[] {
    const actions: TwinAction[] = [];
    const top = open[0];
    if (top) {
      actions.push({
        id: 'repair-top',
        label: `Repair "${top.concept}"`,
        reason: `Seen wrong ${top.frequency}× with severity ${top.severity}/100 — your highest-impact gap right now.`,
        route: '/app/mistakes',
        modality: modality.modality,
        kind: 'repair',
      });
    }
    if (activeFlow) {
      const nextNode = activeFlow.nodes.find(
        (n) => n.status === 'available' || n.status === 'in_progress',
      );
      if (nextNode) {
        actions.push({
          id: 'flow-next',
          label: `Continue your flow: ${nextNode.title}`,
          reason: `Next unlocked step toward "${activeFlow.goal}".`,
          route: `/app/flows/${String(activeFlow._id)}`,
          modality: 'read',
          kind: 'flow',
        });
      }
    }
    const weakness = overview.weaknesses[0];
    if (weakness && !top) {
      actions.push({
        id: 'drill-weak',
        label: `Drill ${weakness.topic}`,
        reason: `Quiz mastery here is low (severity ${weakness.severity}/100).`,
        route: '/app/quizzes',
        modality: 'quiz',
        kind: 'quiz',
      });
    }
    // Modality-routed suggestion.
    const modalityRoute: Record<
      Modality,
      { route: string; label: string; kind: TwinAction['kind'] }
    > = {
      visual: {
        route: '/app/visuals',
        label: 'See your weak concept as a diagram',
        kind: 'visual',
      },
      quiz: {
        route: '/app/quizzes',
        label: 'Take a short targeted quiz',
        kind: 'quiz',
      },
      voice: {
        route: '/app/voice-room',
        label: 'Explain a concept aloud (voice viva)',
        kind: 'voice',
      },
      project: {
        route: '/app/projects',
        label: 'Build a small targeted project',
        kind: 'project',
      },
      read: {
        route: '/app/tutor',
        label: 'Revise with the AI Tutor',
        kind: 'explore',
      },
      mentor: {
        route: '/app/mentor-room',
        label: 'Get a mentor review',
        kind: 'explore',
      },
      simulation: {
        route: '/app/voice-room',
        label: 'Run an interview simulation',
        kind: 'voice',
      },
    };
    const mr = modalityRoute[modality.modality];
    if (!actions.some((a) => a.route === mr.route)) {
      actions.push({
        id: 'modality',
        label: mr.label,
        reason: `Asta's modality router picked ${modality.modality} for you based on your current gaps.`,
        route: mr.route,
        modality: modality.modality,
        kind: mr.kind,
      });
    }
    if (overview.readinessScore < 65 && overview.momentum.projects === 0) {
      actions.push({
        id: 'project',
        label: 'Build a portfolio project',
        reason:
          'Your readiness needs hands-on evidence — a project lifts it the fastest.',
        route: '/app/projects',
        modality: 'project',
        kind: 'project',
      });
    }
    return actions.slice(0, 5);
  }

  private headline(
    pace: SkillTwin['pace'],
    open: MistakeDocument[],
    modality: { modality: Modality },
  ): string {
    const paceMsg =
      pace === 'ahead'
        ? "You're ahead of pace"
        : pace === 'steady'
          ? "You're on a steady pace"
          : "You're behind pace — let's catch up";
    if (open[0])
      return `${paceMsg}. Biggest lever: repair ${open[0].concept} (try ${modality.modality}).`;
    return `${paceMsg}. No open gaps — keep advancing.`;
  }

  /** "Reset learning memory" — clears Mistake OS + flagged weak areas. */
  async resetMemory(userId: string): Promise<{ clearedMistakes: number }> {
    const cleared = await this.mistakes.clearForUser(userId);
    await this.profiles.clearWeakAreas(userId);
    return { clearedMistakes: cleared };
  }
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
