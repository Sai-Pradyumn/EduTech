import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { Course, CourseLesson, CourseModule } from './schemas/course.schema';

/** A body shorter than this teaches nothing — treat as degenerate. */
const MIN_BODY_CHARS = 400;
const MAX_BODY_CHARS = 14_000;

/**
 * Writes the FULL teachable lesson for a course lesson, on demand (first open).
 * Live: the model writes a complete markdown lesson grounded in the course
 * goal/level/audience, the module's summary and the lesson's design brief —
 * intro, concepts with a worked example, common pitfalls, a practice task and
 * a recap. Offline or on any failure: a structured expansion of the existing
 * brief that says plainly it is the outline, never fake depth.
 */
@Injectable()
export class LessonComposerService {
  private readonly logger = new Logger(LessonComposerService.name);

  constructor(private readonly ai: AiService) {}

  async compose(
    userId: string,
    course: Pick<Course, 'title' | 'goal' | 'level' | 'audience'>,
    module: Pick<CourseModule, 'title' | 'summary'>,
    lesson: Pick<CourseLesson, 'title' | 'content' | 'estimateMinutes'>,
  ): Promise<string> {
    if (!this.ai.isLive) return this.fallback(course, module, lesson);

    try {
      const draft = await this.ai.generateStructuredOutput<{ body?: string }>(
        [
          {
            role: 'system',
            content:
              'You are a master teacher writing ONE complete, self-contained lesson in markdown. ' +
              'Structure: a 2–3 sentence intro that says why this matters for the course goal; ' +
              '2–3 "## " sections teaching the core ideas, EACH with one concrete worked example ' +
              '(code, calculation, or realistic scenario — whatever fits the subject); ' +
              '"## Common pitfalls" (2–3 short bullets); "## Try it yourself" (one concrete practice ' +
              'task the learner can do right now); "## Recap" (3–5 bullets). ' +
              '600–1200 words. Match the level and audience. Be specific to THIS lesson — no filler, ' +
              'no "in this lesson we will…" throat-clearing beyond the intro.',
          },
          {
            role: 'user',
            content:
              `Course: ${course.title}\nCourse goal: ${course.goal}\nLevel: ${course.level}\n` +
              `Audience: ${course.audience || 'students'}\nModule: ${module.title}` +
              (module.summary ? ` — ${module.summary}` : '') +
              `\nLesson title: ${lesson.title}\nLesson design brief: ${lesson.content || '(none)'}\n` +
              `Target reading+practice time: ~${lesson.estimateMinutes} minutes.`,
          },
        ],
        {
          type: 'object',
          required: ['body'],
          properties: { body: { type: 'string', minLength: MIN_BODY_CHARS } },
        },
        {
          temperature: 0.5,
          maxTokens: 2600,
          meta: {
            userId,
            agentType: AgentType.ContentCreator,
            operation: 'course.lesson',
            feature: 'course',
          },
          mockFactory: () => ({ body: '' }), // degenerate → fallback below
        },
      );
      const body = draft?.body?.trim() ?? '';
      if (body.length < MIN_BODY_CHARS) {
        return this.fallback(course, module, lesson);
      }
      return body.length > MAX_BODY_CHARS
        ? `${body.slice(0, MAX_BODY_CHARS)}…`
        : body;
    } catch (err) {
      this.logger.warn(
        `Lesson body generation failed: ${(err as Error).message}`,
      );
      return this.fallback(course, module, lesson);
    }
  }

  /** Deterministic outline — honest about being the design brief, never fake depth. */
  private fallback(
    course: Pick<Course, 'goal' | 'level'>,
    module: Pick<CourseModule, 'title' | 'summary'>,
    lesson: Pick<CourseLesson, 'title' | 'content' | 'estimateMinutes'>,
  ): string {
    return [
      `_This is the lesson outline from the course design — full lesson generation needs a live AI provider._`,
      '',
      `## ${lesson.title}`,
      lesson.content ||
        module.summary ||
        `Part of the module "${module.title}".`,
      '',
      '## What to focus on',
      `- How this fits the goal: ${course.goal}`,
      `- Work through it at a ${course.level} pace (~${lesson.estimateMinutes} minutes).`,
      ...(module.summary ? [`- Module context: ${module.summary}`] : []),
      '',
      '## Try it yourself',
      `Explain "${lesson.title}" out loud in your own words, then ask the AI Tutor to check your understanding.`,
    ].join('\n');
  }
}
