import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Difficulty, Role } from '../../common/enums';
import { FlowsService } from '../flows/flows.service';
import { AssessmentService } from '../assessment/services/assessment.service';
import { VisualsService } from '../visuals/visuals.service';
import { ProjectsService } from '../projects/services/projects.service';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import {
  Course,
  CourseDocument,
  CourseVisibility,
} from './schemas/course.schema';
import { CourseArchitectAgent } from './course-architect.agent';
import { LessonComposerService } from './lesson-composer.service';
import { GenerateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Injectable()
export class CourseBuilderService {
  constructor(
    @InjectModel(Course.name) private readonly model: Model<CourseDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    private readonly flows: FlowsService,
    private readonly assessment: AssessmentService,
    private readonly visuals: VisualsService,
    private readonly projects: ProjectsService,
    private readonly architect: CourseArchitectAgent,
    private readonly lessons: LessonComposerService,
  ) {}

  async generate(
    userId: string,
    dto: GenerateCourseDto,
  ): Promise<CourseDocument> {
    const level = dto.level ?? Difficulty.Beginner;
    // Live AI designs the course for THIS goal (modules, lesson briefs, voice
    // scripts); the deterministic blueprint is the offline path.
    const bp = await this.architect.blueprint(userId, dto.goal.trim(), level, {
      outline: dto.outline,
      audience: dto.audience,
    });
    return this.model.create({
      author: new Types.ObjectId(userId),
      title: bp.title,
      goal: dto.goal.trim(),
      description: bp.description,
      audience: dto.audience ?? 'Students',
      level,
      source: dto.outline ? 'outline' : 'goal',
      status: 'draft',
      visibility: 'private',
      modules: bp.modules,
      project: bp.project,
      certificateCriteria: bp.certificateCriteria,
    });
  }

  async fromRoadmap(
    userId: string,
    roadmapId: string,
  ): Promise<CourseDocument> {
    if (!Types.ObjectId.isValid(roadmapId))
      throw new NotFoundException('Roadmap not found');
    const roadmap = await this.roadmaps.findById(roadmapId).exec();
    if (!roadmap || roadmap.user.toString() !== userId)
      throw new NotFoundException('Roadmap not found');
    const outline = roadmap.weeklyPlan.map((w) => w.focus).join('\n');
    const bp = await this.architect.blueprint(
      userId,
      roadmap.goal,
      roadmap.difficulty ?? Difficulty.Beginner,
      { outline },
    );
    return this.model.create({
      author: new Types.ObjectId(userId),
      title: `Course · ${roadmap.title}`,
      goal: roadmap.goal,
      description: bp.description,
      audience: 'Students',
      level: roadmap.difficulty ?? Difficulty.Beginner,
      source: 'roadmap',
      status: 'draft',
      visibility: 'private',
      modules: bp.modules,
      project: bp.project,
      certificateCriteria: bp.certificateCriteria,
    });
  }

  list(userId: string): Promise<CourseDocument[]> {
    return this.model
      .find({ author: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async get(userId: string, id: string): Promise<CourseDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Course not found');
    const c = await this.model.findById(id).exec();
    if (!c || c.author.toString() !== userId)
      throw new NotFoundException('Course not found');
    return c;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCourseDto,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    if (dto.title !== undefined) c.title = dto.title;
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.audience !== undefined) c.audience = dto.audience;
    if (dto.modules) {
      // Merge editable fields by module id (preserves linked quiz/visual ids + voice script).
      c.modules = dto.modules.map((m) => {
        const existing = c.modules.find((x) => x.id === m.id);
        return {
          id: m.id,
          title: m.title,
          summary: m.summary ?? existing?.summary ?? '',
          lessons: (m.lessons ?? existing?.lessons ?? []).map((l) => {
            const prev = existing?.lessons.find((x) => x.id === l.id);
            return {
              id: l.id,
              title: l.title,
              content: l.content ?? '',
              // Generated lesson bodies survive design edits.
              body: prev?.body ?? '',
              bodyGeneratedAt: prev?.bodyGeneratedAt,
              estimateMinutes: prev?.estimateMinutes ?? 20,
            };
          }),
          linkedQuizId: existing?.linkedQuizId,
          linkedVisualId: existing?.linkedVisualId,
          voiceScript: existing?.voiceScript ?? '',
        };
      });
      c.markModified('modules');
    }
    return c.save();
  }

  // ── Learn mode ──

  /**
   * Full lesson body, generated on FIRST open and cached on the lesson.
   * Opening a lesson also records it as the "continue here" point.
   */
  async expandLesson(
    userId: string,
    id: string,
    lessonId: string,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    const mod = c.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
    const lesson = mod?.lessons.find((l) => l.id === lessonId);
    if (!mod || !lesson) throw new NotFoundException('Lesson not found');

    let changed = false;
    if (!lesson.body) {
      lesson.body = await this.lessons.compose(userId, c, mod, lesson);
      lesson.bodyGeneratedAt = new Date();
      changed = true;
    }
    if (c.lastLessonId !== lessonId) {
      c.lastLessonId = lessonId;
      changed = true;
    }
    if (changed) {
      c.markModified('modules');
      await c.save();
    }
    return c;
  }

  /** Rewrite an already-generated lesson body (explicit learner request). */
  async regenerateLesson(
    userId: string,
    id: string,
    lessonId: string,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    const mod = c.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
    const lesson = mod?.lessons.find((l) => l.id === lessonId);
    if (!mod || !lesson) throw new NotFoundException('Lesson not found');
    lesson.body = await this.lessons.compose(userId, c, mod, lesson);
    lesson.bodyGeneratedAt = new Date();
    c.markModified('modules');
    return c.save();
  }

  async setLessonProgress(
    userId: string,
    id: string,
    lessonId: string,
    completed: boolean,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    const exists = c.modules.some((m) =>
      m.lessons.some((l) => l.id === lessonId),
    );
    if (!exists) throw new NotFoundException('Lesson not found');
    const set = new Set(c.completedLessons);
    if (completed) set.add(lessonId);
    else set.delete(lessonId);
    c.completedLessons = [...set];
    return c.save();
  }

  async generateQuiz(
    userId: string,
    id: string,
    moduleId: string,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    const mod = c.modules.find((m) => m.id === moduleId);
    if (!mod) throw new NotFoundException('Module not found');
    const quiz = await this.assessment.generate(userId, {
      source: 'topic',
      topic: mod.title.slice(0, 110),
      difficulty: c.level,
    });
    mod.linkedQuizId = String(quiz._id);
    c.markModified('modules');
    return c.save();
  }

  async generateVisual(
    userId: string,
    id: string,
    moduleId: string,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    const mod = c.modules.find((m) => m.id === moduleId);
    if (!mod) throw new NotFoundException('Module not found');
    const visual = await this.visuals.generate(userId, {
      concept: mod.title,
      type: 'mind_map',
      sourceType: 'manual',
    });
    mod.linkedVisualId = String(visual._id);
    c.markModified('modules');
    return c.save();
  }

  async generateProject(userId: string, id: string): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    const project = await this.projects.generate(userId, {
      goal: c.project.title || `Capstone for ${c.title}`,
    });
    c.project.linkedProjectId = String(project._id);
    c.markModified('project');
    return c.save();
  }

  async generateFlow(
    userId: string,
    id: string,
  ): Promise<{ course: CourseDocument; flowId: string }> {
    const c = await this.get(userId, id);
    const flow = await this.flows.generate(userId, { goal: c.goal });
    c.linkedFlowId = String(flow._id);
    await c.save();
    return { course: c, flowId: String(flow._id) };
  }

  /** Publish to a visibility. org/cohort require a mentor/admin account. */
  async publish(
    userId: string,
    role: Role,
    id: string,
    visibility: CourseVisibility,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    if (
      (visibility === 'org' || visibility === 'cohort') &&
      role !== Role.Mentor &&
      role !== Role.Admin
    ) {
      throw new ForbiddenException(
        'Only mentors or admins can publish to an organization or cohort.',
      );
    }
    c.status = 'published';
    c.visibility = visibility;
    c.publishedAt = new Date();
    return c.save();
  }

  /** Archive (or restore) a course — reversible, unlike remove(). */
  async setArchived(
    userId: string,
    id: string,
    archived: boolean,
  ): Promise<CourseDocument> {
    const c = await this.get(userId, id);
    c.status = archived ? 'archived' : c.publishedAt ? 'published' : 'draft';
    return c.save();
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const c = await this.get(userId, id);
    await c.deleteOne();
    return { ok: true };
  }
}
