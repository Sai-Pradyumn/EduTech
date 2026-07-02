import { Injectable, Logger } from '@nestjs/common';
import { AgentType, AssessmentKind } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { AIMessage } from '../../ai/interfaces/ai-provider.interface';
import {
  GeneratedRoadmap,
  RoadmapAssessment,
  RoadmapMilestone,
  RoadmapProject,
  RoadmapWeek,
} from '../../roadmap/types/generated-roadmap.types';
import {
  buildRoadmapBlueprint,
  RoadmapBlueprintInput,
} from './roadmap-blueprint.generator';

/** Schema for regenerating a single week in place. */
const WEEK_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['title', 'focus', 'topics', 'tasks'],
  properties: {
    title: { type: 'string' },
    focus: { type: 'string' },
    topics: { type: 'array', items: { type: 'string' } },
    tasks: { type: 'array', items: { type: 'string' } },
    practiceItems: { type: 'array', items: { type: 'string' } },
    expectedOutcome: { type: 'string' },
  },
};

/**
 * Full contract handed to real providers AND enforced by the AI contract pipeline.
 * Every array declares its item shape — the failure mode where the model returns
 * `milestones: ["Complete Java basics course"]` (bare strings instead of objects)
 * is now a schema violation that triggers repair, never a Mongoose cast error.
 */
const ROADMAP_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['title', 'goal', 'overview', 'weeklyPlan', 'milestones'],
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    overview: { type: 'string' },
    estimatedDuration: { type: 'string' },
    difficulty: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    weeklyPlan: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['weekNumber', 'title', 'focus', 'topics', 'tasks'],
        properties: {
          weekNumber: { type: 'integer' },
          title: { type: 'string' },
          focus: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
          tasks: { type: 'array', items: { type: 'string' } },
          practiceItems: { type: 'array', items: { type: 'string' } },
          expectedOutcome: { type: 'string' },
        },
      },
    },
    milestones: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['title', 'targetWeek'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          targetWeek: { type: 'integer' },
          completionCriteria: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    recommendedProjects: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          difficulty: { type: 'string' },
          skillsCovered: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    assessmentPlan: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'week'],
        properties: {
          title: { type: 'string' },
          week: { type: 'integer' },
          type: {
            type: 'string',
            enum: Object.values(AssessmentKind),
          },
          description: { type: 'string' },
        },
      },
    },
    dailyStudyPlan: { type: 'array', items: { type: 'string' } },
    successTips: { type: 'array', items: { type: 'string' } },
  },
};

type UnknownRecord = Record<string, unknown>;
const isObj = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asStringList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        )
        .map((s) => s.trim())
    : [];
const asInt = (v: unknown, dflt: number): number =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(1, Math.round(v))
    : dflt;

@Injectable()
export class RoadmapAgentService {
  readonly type = AgentType.Roadmap;
  private readonly logger = new Logger(RoadmapAgentService.name);

  constructor(private readonly ai: AiService) {}

  /** Generate a structured, personalized roadmap for a student. */
  async generate(
    userId: string,
    input: RoadmapBlueprintInput,
  ): Promise<GeneratedRoadmap> {
    const startedAt = Date.now();
    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: this.userPrompt(input) },
    ];

    let roadmap: GeneratedRoadmap | null;
    try {
      const draft = await this.ai.generateStructuredOutput<GeneratedRoadmap>(
        messages,
        ROADMAP_SCHEMA,
        {
          // Mock provider returns this; real providers honor the schema instead.
          mockFactory: () => buildRoadmapBlueprint(input),
          meta: { operation: 'roadmap.generate' },
        },
      );
      roadmap = this.sanitize(draft, input);
    } catch (err) {
      this.logger.error(`Roadmap generation failed: ${(err as Error).message}`);
      roadmap = null;
    }

    if (!roadmap) {
      // Deterministic path: the roadmap flow never dead-ends on bad model output.
      this.logger.warn(
        'AI roadmap output unusable — using local blueprint fallback.',
      );
      roadmap = buildRoadmapBlueprint(input);
    }

    await this.ai.logUsage({
      userId,
      agentType: this.type,
      operation: 'structured',
      tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
      tokensOut: JSON.stringify(roadmap).length,
      latencyMs: Date.now() - startedAt,
    });

    return roadmap;
  }

  /** Regenerate a single week in place — honours an optional adjustment note from the learner. */
  async regenerateWeek(
    userId: string,
    input: RoadmapBlueprintInput,
    current: RoadmapWeek,
    note?: string,
  ): Promise<RoadmapWeek> {
    const startedAt = Date.now();
    const messages: AIMessage[] = [
      {
        role: 'system',
        content:
          "You are Asta's Roadmap Agent. Regenerate ONE week of an existing roadmap. " +
          'Keep it the same scope/duration but improve or re-angle it. ' +
          'If an adjustment note is given, honour it. Return strictly the RoadmapWeek JSON shape (no weekNumber).',
      },
      {
        role: 'user',
        content: JSON.stringify({
          goal: input.mainGoal,
          skillLevel: input.currentSkillLevel,
          weakAreas: input.weakAreas,
          timePerDay: input.availableTimePerDay,
          careerTarget: input.careerTarget,
          currentWeek: current,
          adjustment: note ?? null,
        }),
      },
    ];

    let week: RoadmapWeek;
    try {
      week = await this.ai.generateStructuredOutput<RoadmapWeek>(
        messages,
        WEEK_SCHEMA,
        {
          mockFactory: () => this.mockWeek(current, note),
          meta: { operation: 'roadmap.week' },
        },
      );
    } catch (err) {
      this.logger.warn(`Week regeneration failed: ${(err as Error).message}`);
      week = this.mockWeek(current, note);
    }

    const safe: RoadmapWeek = {
      weekNumber: current.weekNumber,
      title: week?.title?.trim() || current.title,
      focus: week?.focus?.trim() || note || current.focus,
      topics:
        Array.isArray(week?.topics) && week.topics.length
          ? week.topics
          : current.topics,
      tasks:
        Array.isArray(week?.tasks) && week.tasks.length
          ? week.tasks
          : current.tasks,
      practiceItems: Array.isArray(week?.practiceItems)
        ? week.practiceItems
        : (current.practiceItems ?? []),
      expectedOutcome:
        week?.expectedOutcome?.trim() || current.expectedOutcome || '',
    };

    await this.ai.logUsage({
      userId,
      agentType: this.type,
      operation: 'structured',
      tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
      tokensOut: JSON.stringify(safe).length,
      latencyMs: Date.now() - startedAt,
    });
    return safe;
  }

  /** Offline/dev fallback — folds the learner's adjustment note into the existing week. */
  private mockWeek(current: RoadmapWeek, note?: string): RoadmapWeek {
    const base = current.title.replace(/\s*\((?:revised|focus:[^)]*)\)$/i, '');
    return {
      ...current,
      title: `${base} (${note ? `focus: ${note}` : 'revised'})`,
      focus: note || current.focus,
      tasks: note ? [`Apply: ${note}`, ...current.tasks] : current.tasks,
    };
  }

  /**
   * Normalize a model roadmap into the exact persisted shape: coerce recoverable
   * drift (a milestone/project/assessment returned as a bare string becomes a real
   * object; a daily-plan entry returned as an object is rendered to a line),
   * renumber weeks sequentially, drop garbage, and per-field fall back to the
   * deterministic blueprint for optional collections. Returns null when the weekly
   * core is unusable so the caller falls back wholesale — nothing half-broken is
   * ever handed to persistence.
   */
  private sanitize(
    raw: unknown,
    input: RoadmapBlueprintInput,
  ): GeneratedRoadmap | null {
    if (!isObj(raw)) return null;
    const blueprint = buildRoadmapBlueprint(input);

    const weeks: RoadmapWeek[] = (
      Array.isArray(raw.weeklyPlan) ? raw.weeklyPlan : []
    )
      .map((w, i): RoadmapWeek | null => {
        if (!isObj(w)) return null;
        const title = asText(w.title);
        const focus = asText(w.focus);
        const topics = asStringList(w.topics);
        const tasks = asStringList(w.tasks);
        if (!title && !focus) return null;
        if (topics.length === 0 && tasks.length === 0) return null;
        return {
          weekNumber: i + 1, // renumbered again after filtering
          title: title || `Week ${i + 1}: ${focus}`,
          focus: focus || title,
          topics,
          tasks: tasks.length
            ? tasks
            : topics.map((t) => `Study and practice: ${t}`),
          practiceItems: asStringList(w.practiceItems),
          expectedOutcome: asText(w.expectedOutcome),
        };
      })
      .filter((w): w is RoadmapWeek => w !== null)
      .map((w, i) => ({ ...w, weekNumber: i + 1 }));

    if (weeks.length < 2) return null;
    const lastWeek = weeks.length;
    const clampWeek = (v: unknown, dflt: number): number =>
      Math.min(lastWeek, asInt(v, dflt));
    /** Even spread of item i of n across the plan, for items missing a week. */
    const spreadWeek = (i: number, n: number): number =>
      Math.max(1, Math.round(((i + 1) * lastWeek) / Math.max(1, n)));

    const milestones: RoadmapMilestone[] = (
      Array.isArray(raw.milestones) ? raw.milestones : []
    )
      .map((m, i, all): RoadmapMilestone | null => {
        if (typeof m === 'string' && m.trim()) {
          return {
            title: m.trim(),
            description: '',
            targetWeek: spreadWeek(i, all.length),
            completionCriteria: [],
          };
        }
        if (!isObj(m) || !asText(m.title)) return null;
        return {
          title: asText(m.title),
          description: asText(m.description),
          targetWeek: clampWeek(m.targetWeek, spreadWeek(i, all.length)),
          completionCriteria: asStringList(m.completionCriteria),
        };
      })
      .filter((m): m is RoadmapMilestone => m !== null);
    if (milestones.length === 0) {
      // Synthesize an honest terminal milestone instead of dropping good weeks.
      milestones.push({
        title: `Reach the goal: ${asText(raw.goal) || input.mainGoal}`,
        description: 'All weekly work completed and demonstrated.',
        targetWeek: lastWeek,
        completionCriteria: ['Complete every week of the plan'],
      });
    }

    const projects: RoadmapProject[] = (
      Array.isArray(raw.recommendedProjects) ? raw.recommendedProjects : []
    )
      .map((p): RoadmapProject | null => {
        if (typeof p === 'string' && p.trim()) {
          return {
            title: p.trim(),
            description: '',
            difficulty: blueprint.difficulty,
            skillsCovered: [],
          };
        }
        if (!isObj(p) || !asText(p.title)) return null;
        return {
          title: asText(p.title),
          description: asText(p.description),
          difficulty: asText(p.difficulty) || blueprint.difficulty,
          skillsCovered: asStringList(p.skillsCovered),
        };
      })
      .filter((p): p is RoadmapProject => p !== null);

    const kinds = Object.values(AssessmentKind) as string[];
    const assessments: RoadmapAssessment[] = (
      Array.isArray(raw.assessmentPlan) ? raw.assessmentPlan : []
    )
      .map((a, i, all): RoadmapAssessment | null => {
        if (typeof a === 'string' && a.trim()) {
          return {
            title: a.trim(),
            week: spreadWeek(i, all.length),
            type: AssessmentKind.Quiz,
            description: '',
          };
        }
        if (!isObj(a) || !asText(a.title)) return null;
        const kind = asText(a.type).toLowerCase();
        return {
          title: asText(a.title),
          week: clampWeek(a.week, spreadWeek(i, all.length)),
          type: (kinds.includes(kind)
            ? kind
            : AssessmentKind.Quiz) as RoadmapAssessment['type'],
          description: asText(a.description),
        };
      })
      .filter((a): a is RoadmapAssessment => a !== null);

    const daily = (Array.isArray(raw.dailyStudyPlan) ? raw.dailyStudyPlan : [])
      .map((d): string | null => {
        if (typeof d === 'string' && d.trim()) {
          // A serialized object/array dump is not a study-plan line.
          return /^[[{]/.test(d.trim()) && d.trim().length > 120
            ? null
            : d.trim();
        }
        if (isObj(d)) {
          // Common model drift: { day, topic, tasks } objects instead of strings.
          const day = asInt(d.day, 0);
          const topic = asText(d.topic) || asText(d.title) || asText(d.focus);
          const tasks = asStringList(d.tasks).join('; ');
          const parts = [day ? `Day ${day}` : '', topic, tasks].filter(Boolean);
          if (parts.length) return parts.join(' — ');
        }
        return null;
      })
      .filter((s): s is string => s !== null);

    const difficulties = ['beginner', 'intermediate', 'advanced'];
    const difficulty = difficulties.includes(asText(raw.difficulty))
      ? (asText(raw.difficulty) as GeneratedRoadmap['difficulty'])
      : blueprint.difficulty;

    return {
      title: asText(raw.title) || blueprint.title,
      goal: asText(raw.goal) || input.mainGoal,
      overview: asText(raw.overview) || blueprint.overview,
      estimatedDuration:
        asText(raw.estimatedDuration) || blueprint.estimatedDuration,
      difficulty,
      weeklyPlan: weeks,
      milestones,
      recommendedProjects: projects.length
        ? projects
        : blueprint.recommendedProjects,
      assessmentPlan: assessments.length
        ? assessments
        : blueprint.assessmentPlan.map((a) => ({
            ...a,
            week: Math.min(a.week, lastWeek),
          })),
      dailyStudyPlan: daily.length ? daily : blueprint.dailyStudyPlan,
      successTips: asStringList(raw.successTips).length
        ? asStringList(raw.successTips)
        : blueprint.successTips,
    };
  }

  private systemPrompt(): string {
    return [
      "You are Asta's Roadmap Agent. Produce a structured, realistic, week-by-week learning roadmap.",
      "Personalize to the student's skill level, weak areas, available time, timeline and career target.",
      'Every weeklyPlan item is an OBJECT with weekNumber, title, focus, topics[] and tasks[] — never a bare string.',
      'milestones, recommendedProjects and assessmentPlan items are objects too; dailyStudyPlan and successTips are arrays of short strings.',
      'Return strictly the GeneratedRoadmap JSON shape. Be concrete; avoid vague filler.',
    ].join(' ');
  }

  private userPrompt(i: RoadmapBlueprintInput): string {
    return JSON.stringify({
      goal: i.mainGoal,
      skillLevel: i.currentSkillLevel,
      currentSkills: i.currentSkills,
      weakAreas: i.weakAreas,
      timePerDay: i.availableTimePerDay,
      timeline: i.targetTimeline,
      learningStyle: i.preferredLearningStyle,
      careerTarget: i.careerTarget,
    });
  }
}
