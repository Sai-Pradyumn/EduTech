import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChatCommandRegistryService,
  ChatCommandResult,
} from '../agents/core/chat-command-registry.service';
import { CourseBuilderService } from './course-builder.service';
import { CourseDocument } from './schemas/course.schema';

/**
 * Course chat commands:
 *   "archive my typescript course"   → really archived (undoable)
 *   "unarchive my typescript course" → back to draft/published
 *   "continue my course"             → routes to the next incomplete lesson
 * Questions never write.
 */
@Injectable()
export class CourseChatCommands implements OnModuleInit {
  constructor(
    private readonly registry: ChatCommandRegistryService,
    private readonly courses: CourseBuilderService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'course.create',
      description: 'Create a new course for a topic',
      examples: [
        'create a course on typescript',
        'build me a course for react hooks',
      ],
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /(?:create|generate|make|build|design)\s+(?:me\s+)?(?:a\s+|an\s+|my\s+)?(?:new\s+)?course\s+(?:on|about|for|to\s+(?:learn|teach|master))\s+(.{3,200})/i.exec(
              m.trim(),
            );
          return r ? { goal: r[1].trim() } : null;
        }),
      execute: (userId, p) => this.createCourse(userId, p.goal as string),
    });

    this.registry.register({
      name: 'course.archive',
      description: 'Archive a course',
      examples: ['archive my typescript course'],
      match: (m) =>
        this.guarded(m, () => {
          const r = /^archive\s+(?:my\s+|the\s+)?(.{2,80}?)\s+course\s*$/i.exec(
            m.trim(),
          );
          return r ? { name: r[1].trim() } : null;
        }),
      execute: (userId, p) => this.archive(userId, p.name as string, true),
    });

    this.registry.register({
      name: 'course.unarchive',
      description: 'Restore an archived course',
      examples: ['restore my typescript course'],
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /^(?:unarchive|restore)\s+(?:my\s+|the\s+)?(.{2,80}?)\s+course\s*$/i.exec(
              m.trim(),
            );
          return r ? { name: r[1].trim() } : null;
        }),
      execute: (userId, p) => this.archive(userId, p.name as string, false),
    });

    this.registry.register({
      name: 'course.continue',
      description: 'Continue a course where you left off',
      examples: ['continue my course'],
      match: (m) =>
        this.guarded(m, () => {
          const r =
            /^continue\s+(?:with\s+)?(?:my\s+|the\s+)?(?:(.{2,80}?)\s+)?course\s*$/i.exec(
              m.trim(),
            );
          return r ? { name: r[1]?.trim() ?? '' } : null;
        }),
      execute: (userId, p) => this.continueCourse(userId, p.name as string),
    });
  }

  /** Create a real course from a chat request via the normal generation pipeline. */
  private async createCourse(
    userId: string,
    goal: string,
  ): Promise<ChatCommandResult> {
    const clean = goal
      .replace(/[.!?]+$/, '')
      .trim()
      .slice(0, 160);
    if (clean.length < 2) {
      return {
        ok: false,
        summary:
          'I couldn\'t tell what the course should cover — try "create a course on TypeScript".',
      };
    }
    const course = await this.courses.generate(userId, { goal: clean });
    const lessons = course.modules.flatMap((m) => m.lessons).length;
    return {
      ok: true,
      summary: `Created a new course — "${course.title}" (${course.modules.length} modules, ${lessons} lessons). It's a private draft you can refine and publish.`,
      route: `/app/course-builder/${String(course._id)}`,
      routeLabel: 'Open course',
    };
  }

  private async archive(
    userId: string,
    name: string,
    archived: boolean,
  ): Promise<ChatCommandResult> {
    const course = await this.resolve(
      userId,
      name,
      archived ? 'active' : 'archived',
    );
    if (!course) {
      return {
        ok: false,
        summary: `No ${archived ? '' : 'archived '}course matches "${name}" — nothing was changed.`,
        route: '/app/course-builder',
        routeLabel: 'Open courses',
      };
    }
    const updated = await this.courses.setArchived(
      userId,
      String(course._id),
      archived,
    );
    return {
      ok: true,
      summary: archived
        ? `Archived "${updated.title}" — it's out of your way but nothing was deleted.`
        : `Restored "${updated.title}" (${updated.status}).`,
      route: '/app/course-builder',
      routeLabel: 'Open courses',
      undo: {
        text: archived
          ? `unarchive my ${updated.title} course`
          : `archive my ${updated.title} course`,
      },
    };
  }

  private async continueCourse(
    userId: string,
    name: string,
  ): Promise<ChatCommandResult> {
    const course = await this.resolve(userId, name, 'active');
    if (!course) {
      return {
        ok: false,
        summary: name
          ? `No course matches "${name}".`
          : "You don't have a course to continue yet — generate one from a goal or your roadmap.",
        route: '/app/course-builder',
        routeLabel: 'Open Course Builder',
      };
    }
    const lessons = course.modules.flatMap((m) => m.lessons);
    const done = new Set(course.completedLessons ?? []);
    const next =
      (course.lastLessonId &&
        lessons.find((l) => l.id === course.lastLessonId && !done.has(l.id))) ||
      lessons.find((l) => !done.has(l.id));
    return {
      ok: true,
      summary: next
        ? `Continuing "${course.title}" — next up: "${next.title}" (${done.size}/${lessons.length} lessons done).`
        : `"${course.title}" is fully complete (${lessons.length}/${lessons.length} lessons) — time for the capstone! 🎉`,
      route: `/app/course-builder/${String(course._id)}`,
      routeLabel: 'Open course',
    };
  }

  /**
   * Resolve by lexical match on title+goal. Empty name → most recently updated.
   * `pool` filters archived vs non-archived courses.
   */
  private async resolve(
    userId: string,
    name: string,
    pool: 'active' | 'archived',
  ): Promise<CourseDocument | null> {
    const all = await this.courses.list(userId);
    const candidates = all.filter((c) =>
      pool === 'archived' ? c.status === 'archived' : c.status !== 'archived',
    );
    if (candidates.length === 0) return null;
    const terms = this.tokens(name);
    if (terms.length === 0) return candidates[0]; // newest first from list()
    let best: { course: CourseDocument; score: number } | null = null;
    for (const course of candidates) {
      const hay = new Set(this.tokens(`${course.title} ${course.goal}`));
      let score = 0;
      for (const t of terms) if (hay.has(t)) score++;
      if (score > 0 && (!best || score > best.score)) best = { course, score };
    }
    return best?.course ?? null;
  }

  private tokens(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length > 2 && !['course', 'the', 'and', 'for'].includes(t),
    );
  }

  /** Questions never write. */
  private guarded(
    message: string,
    run: () => Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    const m = message.trim();
    if (!m || m.includes('?')) return null;
    return run();
  }
}
