import { Injectable, Logger } from '@nestjs/common';
import { AgentType, Difficulty } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { CourseModule, CourseProject } from './schemas/course.schema';
import { buildCourseBlueprint } from './course-blueprint.generator';

export interface CourseBlueprint {
  title: string;
  description: string;
  modules: CourseModule[];
  project: CourseProject;
  certificateCriteria: string[];
}

/** Raw model output before ids/clamps are applied. */
interface DraftBlueprint {
  title?: string;
  description?: string;
  modules?: {
    title?: string;
    summary?: string;
    voiceScript?: string;
    lessons?: { title?: string; content?: string; estimateMinutes?: number }[];
  }[];
  project?: { title?: string; brief?: string };
  certificateCriteria?: string[];
}

const MAX_MODULES = 8;
const MIN_MODULES = 3;
const MAX_LESSONS = 5;
const MAX_TITLE = 90;
const MAX_SUMMARY = 200;
const MAX_CONTENT = 700;

/**
 * Course architecture, generated for THIS goal. Live: the model designs the
 * module/lesson structure (respecting a supplied outline), writes real lesson
 * briefs and per-module voice scripts, tuned to level + audience. The output is
 * sanitized hard (module/lesson caps, length clamps, ids assigned server-side).
 * Offline or on any failure: the deterministic blueprint (curated tracks +
 * generic backbone) — a course can always be generated.
 */
@Injectable()
export class CourseArchitectAgent {
  private readonly logger = new Logger(CourseArchitectAgent.name);

  constructor(private readonly ai: AiService) {}

  async blueprint(
    userId: string,
    goal: string,
    level: Difficulty,
    opts?: { outline?: string; audience?: string },
  ): Promise<CourseBlueprint> {
    const fallback = buildCourseBlueprint(goal, level, opts?.outline);
    if (!this.ai.isLive) return fallback;

    try {
      const draft = await this.ai.generateStructuredOutput<DraftBlueprint>(
        [
          {
            role: 'system',
            content:
              'You are a senior curriculum designer. Design a complete, practical course for the ' +
              'given goal: a sharp title, a 1–2 sentence description, 4–7 modules that build on ' +
              'each other (each with a one-line summary, a short spoken-style voiceScript, and 2–4 ' +
              'lessons whose content is a concrete 2–4 sentence lesson brief — what is taught, the ' +
              'example used, what the learner does), one capstone project (title + brief) and 3 ' +
              'certificate criteria. Be specific to the goal — no filler like "core concepts".',
          },
          {
            role: 'user',
            content:
              `Goal: ${goal}\nLevel: ${level}\nAudience: ${opts?.audience ?? 'students'}` +
              (opts?.outline
                ? `\nRequired module outline (one module per line, keep this structure):\n${opts.outline}`
                : ''),
          },
        ],
        {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            modules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  voiceScript: { type: 'string' },
                  lessons: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        content: { type: 'string' },
                        estimateMinutes: { type: 'number' },
                      },
                      required: ['title', 'content'],
                    },
                  },
                },
                required: ['title', 'lessons'],
              },
            },
            project: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                brief: { type: 'string' },
              },
            },
            certificateCriteria: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'modules'],
        },
        {
          temperature: 0.5,
          maxTokens: 3000,
          meta: {
            userId,
            agentType: AgentType.ContentCreator,
            operation: 'course.blueprint',
          },
          mockFactory: (): DraftBlueprint => ({ modules: [] }), // → fallback below
        },
      );
      return this.sanitize(draft, goal, level) ?? fallback;
    } catch (err) {
      this.logger.warn(`Course blueprint failed: ${(err as Error).message}`);
      return fallback;
    }
  }

  /** Clamp, trim and assign server-side ids; degenerate drafts return null. */
  private sanitize(
    draft: DraftBlueprint,
    goal: string,
    level: Difficulty,
  ): CourseBlueprint | null {
    const modules = (draft?.modules ?? [])
      .filter(
        (m) =>
          m?.title?.trim() && (m.lessons ?? []).some((l) => l?.title?.trim()),
      )
      .slice(0, MAX_MODULES)
      .map((m, i) => {
        const id = `m_${i}`;
        const lessons = (m.lessons ?? [])
          .filter((l) => l?.title?.trim())
          .slice(0, MAX_LESSONS)
          .map((l, j) => ({
            id: `${id}_l${j}`,
            title: this.cut(l.title!, MAX_TITLE),
            content: this.cut(l.content ?? '', MAX_CONTENT),
            estimateMinutes: this.clampInt(l.estimateMinutes, 5, 90, 20),
          }));
        return {
          id,
          title: this.cut(m.title!, MAX_TITLE),
          summary: this.cut(m.summary ?? '', MAX_SUMMARY),
          lessons,
          voiceScript: this.cut(m.voiceScript ?? '', 500),
        };
      })
      .filter((m) => m.lessons.length > 0);

    if (modules.length < MIN_MODULES) return null;

    return {
      title: this.cut(draft.title?.trim() || goal, MAX_TITLE),
      description: this.cut(
        draft.description?.trim() ||
          `A ${level} course on ${goal}: ${modules.length} modules with quizzes, visuals and a capstone.`,
        300,
      ),
      modules,
      project: {
        title: this.cut(
          draft.project?.title?.trim() || `Capstone: ${goal}`,
          MAX_TITLE,
        ),
        brief: this.cut(
          draft.project?.brief?.trim() ||
            `Build a project that demonstrates ${goal} end-to-end.`,
          400,
        ),
      },
      certificateCriteria: this.criteria(draft.certificateCriteria),
    };
  }

  private criteria(raw: string[] | undefined): string[] {
    const cleaned = (raw ?? [])
      .filter((c) => c?.trim())
      .slice(0, 5)
      .map((c) => this.cut(c, 120));
    return cleaned.length
      ? cleaned
      : [
          'Complete every module',
          'Pass each module quiz (70%+)',
          'Submit the capstone project',
        ];
  }

  private cut(s: string, max: number): string {
    const t = s.trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  }

  private clampInt(
    n: number | undefined,
    min: number,
    max: number,
    dflt: number,
  ): number {
    if (typeof n !== 'number' || !Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, Math.round(n)));
  }
}
