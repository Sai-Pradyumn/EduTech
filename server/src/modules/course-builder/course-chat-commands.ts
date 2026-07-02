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
      name: 'course.archive',
      description: 'Archive a course',
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
