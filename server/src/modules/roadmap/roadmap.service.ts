import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Difficulty, RoadmapStatus } from '../../common/enums';
import {
  PROGRESSION_EVENTS,
  WeekCompletedEvent,
} from '../progression/progression.events';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { RoadmapAgentService } from '../agents/roadmap/roadmap-agent.service';
import { RoadmapBlueprintInput } from '../agents/roadmap/roadmap-blueprint.generator';
import { Roadmap, RoadmapDocument } from './schemas/roadmap.schema';
import {
  RoadmapVersion,
  RoadmapVersionDocument,
} from './schemas/roadmap-version.schema';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';
import { UpdateRoadmapProgressDto } from './dto/update-roadmap-progress.dto';
import { UpdateRoadmapStatusDto } from './dto/update-roadmap-status.dto';

/** Git-style history: how many content snapshots each roadmap keeps. */
const MAX_VERSIONS = 20;

/** Content fields captured by a version (progress is never versioned). */
const CONTENT_FIELDS = [
  'title',
  'goal',
  'overview',
  'estimatedDuration',
  'difficulty',
  'weeklyPlan',
  'milestones',
  'recommendedProjects',
  'assessmentPlan',
  'dailyStudyPlan',
  'successTips',
] as const;

export interface RoadmapVersionSummary {
  version: number;
  label: string;
  createdAt: string;
  weeks: number;
  current: boolean;
}

@Injectable()
export class RoadmapService {
  constructor(
    @InjectModel(Roadmap.name) private readonly model: Model<RoadmapDocument>,
    @InjectModel(RoadmapVersion.name)
    private readonly versions: Model<RoadmapVersionDocument>,
    private readonly profiles: StudentProfileService,
    private readonly roadmapAgent: RoadmapAgentService,
    private readonly events: EventEmitter2,
  ) {}

  /** Generate from the student's profile (with optional goal/timeline/intensity overrides). */
  async generate(
    userId: string,
    dto: GenerateRoadmapDto,
  ): Promise<RoadmapDocument> {
    const profile = await this.profiles.findByUserOrThrow(userId);

    const input: RoadmapBlueprintInput = {
      fullName: profile.fullName,
      mainGoal: dto.goal?.trim() || profile.mainGoal,
      currentSkillLevel: profile.currentSkillLevel,
      currentSkills: profile.currentSkills,
      weakAreas: profile.weakAreas,
      availableTimePerDay:
        dto.availableTimePerDay ?? profile.availableTimePerDay,
      targetTimeline: dto.targetTimeline ?? profile.targetTimeline,
      preferredLearningStyle: profile.preferredLearningStyle,
      careerTarget: profile.careerTarget,
    };

    const generated = await this.roadmapAgent.generate(userId, input);

    // New roadmap becomes the active one; archive any previously active roadmaps.
    await this.model
      .updateMany(
        { user: profile.user, status: RoadmapStatus.Active },
        { status: RoadmapStatus.Archived },
      )
      .exec();

    const created = await this.model.create({
      user: profile.user,
      studentProfile: profile._id,
      title: generated.title,
      goal: generated.goal,
      overview: generated.overview,
      estimatedDuration: generated.estimatedDuration,
      difficulty: generated.difficulty as Difficulty,
      weeklyPlan: generated.weeklyPlan,
      milestones: generated.milestones,
      recommendedProjects: generated.recommendedProjects,
      assessmentPlan: generated.assessmentPlan,
      dailyStudyPlan: generated.dailyStudyPlan,
      successTips: generated.successTips,
      status: RoadmapStatus.Active,
      progressPercentage: 0,
      completedWeeks: [],
      completedTasks: [],
    });
    await this.snapshot(created, 'Generated');
    return created;
  }

  findMine(userId: string): Promise<RoadmapDocument[]> {
    return this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ status: 1, updatedAt: -1 })
      .exec();
  }

  findActive(userId: string): Promise<RoadmapDocument | null> {
    return this.model
      .findOne({
        user: new Types.ObjectId(userId),
        status: RoadmapStatus.Active,
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findByIdForUser(userId: string, id: string): Promise<RoadmapDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Roadmap not found');
    const roadmap = await this.model.findById(id).exec();
    if (!roadmap) throw new NotFoundException('Roadmap not found');
    this.assertOwner(roadmap, userId);
    return roadmap;
  }

  async updateProgress(
    userId: string,
    id: string,
    dto: UpdateRoadmapProgressDto,
  ): Promise<RoadmapDocument> {
    const roadmap = await this.findByIdForUser(userId, id);

    let newlyCompletedWeek: number | null = null;
    if (
      typeof dto.weekNumber === 'number' &&
      typeof dto.weekCompleted === 'boolean'
    ) {
      const set = new Set(roadmap.completedWeeks);
      if (dto.weekCompleted && !set.has(dto.weekNumber))
        newlyCompletedWeek = dto.weekNumber;
      if (dto.weekCompleted) set.add(dto.weekNumber);
      else set.delete(dto.weekNumber);
      roadmap.completedWeeks = [...set].sort((a, b) => a - b);
      if (newlyCompletedWeek !== null) {
        const wk = roadmap.weeklyPlan.find(
          (w) => w.weekNumber === newlyCompletedWeek,
        );
        this.logActivity(
          roadmap,
          'week',
          `Week ${newlyCompletedWeek}${wk ? ` — ${wk.focus || wk.title}` : ''}`,
        );
      }
    }

    if (dto.taskId && typeof dto.taskCompleted === 'boolean') {
      const set = new Set(roadmap.completedTasks);
      const taskJustDone = dto.taskCompleted && !set.has(dto.taskId);
      if (dto.taskCompleted) set.add(dto.taskId);
      else set.delete(dto.taskId);
      roadmap.completedTasks = [...set];
      if (taskJustDone)
        this.logActivity(roadmap, 'task', this.taskLabel(roadmap, dto.taskId));
    }

    roadmap.progressPercentage = this.computeProgress(roadmap);
    if (
      roadmap.progressPercentage >= 100 &&
      roadmap.status === RoadmapStatus.Active
    ) {
      roadmap.status = RoadmapStatus.Completed;
    }
    const saved = await roadmap.save();

    // Autonomous progression: a freshly-completed week triggers a forward nudge.
    if (newlyCompletedWeek !== null) {
      const nextWeek = saved.weeklyPlan
        .filter((w) => !saved.completedWeeks.includes(w.weekNumber))
        .sort((a, b) => a.weekNumber - b.weekNumber)[0];
      this.events.emit(PROGRESSION_EVENTS.weekCompleted, {
        userId,
        roadmapTitle: saved.title,
        weekNumber: newlyCompletedWeek,
        nextWeekFocus: nextWeek?.focus,
      } satisfies WeekCompletedEvent);
    }
    return saved;
  }

  /** Regenerate a single week in place (LLM, with a mock fallback). Resets that week's progress. */
  async regenerateWeek(
    userId: string,
    id: string,
    weekNumber: number,
    note?: string,
  ): Promise<RoadmapDocument> {
    const roadmap = await this.findByIdForUser(userId, id);
    const idx = roadmap.weeklyPlan.findIndex(
      (w) => w.weekNumber === weekNumber,
    );
    if (idx < 0) throw new NotFoundException('Week not found');

    const profile = await this.profiles.findByUserOrThrow(userId);
    const input: RoadmapBlueprintInput = {
      fullName: profile.fullName,
      mainGoal: roadmap.goal || profile.mainGoal,
      currentSkillLevel: profile.currentSkillLevel,
      currentSkills: profile.currentSkills,
      weakAreas: profile.weakAreas,
      availableTimePerDay: profile.availableTimePerDay,
      targetTimeline: profile.targetTimeline,
      preferredLearningStyle: profile.preferredLearningStyle,
      careerTarget: profile.careerTarget,
    };

    const newWeek = await this.roadmapAgent.regenerateWeek(
      userId,
      input,
      roadmap.weeklyPlan[idx],
      note?.trim() || undefined,
    );
    roadmap.weeklyPlan[idx] = { ...newWeek, weekNumber };
    roadmap.markModified('weeklyPlan');

    // Content changed → un-complete this week and its tasks, then recompute progress.
    roadmap.completedWeeks = roadmap.completedWeeks.filter(
      (w) => w !== weekNumber,
    );
    roadmap.completedTasks = roadmap.completedTasks.filter(
      (t) => !t.startsWith(`w${weekNumber}:`),
    );
    roadmap.progressPercentage = this.computeProgress(roadmap);
    if (
      roadmap.status === RoadmapStatus.Completed &&
      roadmap.progressPercentage < 100
    ) {
      roadmap.status = RoadmapStatus.Active;
    }
    this.logActivity(roadmap, 'week', `Regenerated Week ${weekNumber}`);
    const saved = await roadmap.save();
    await this.snapshot(
      saved,
      `Week ${weekNumber} regenerated${note?.trim() ? `: ${note.trim()}` : ''}`,
    );
    return saved;
  }

  /**
   * Adaptive re-plan: when the learner's real pace has slipped, regenerate the
   * next not-yet-completed weeks (capped — this is one LLM call per week) so the
   * plan fits reality instead of guilt-tripping. Progress on completed weeks is
   * untouched; re-planned weeks' task progress resets; the whole change is one
   * restorable version.
   */
  async replanRemaining(
    userId: string,
    id: string,
    note?: string,
  ): Promise<RoadmapDocument> {
    const REPLAN_MAX_WEEKS = 4;
    const roadmap = await this.findByIdForUser(userId, id);
    const remaining = roadmap.weeklyPlan
      .filter((w) => !roadmap.completedWeeks.includes(w.weekNumber))
      .slice(0, REPLAN_MAX_WEEKS);
    if (remaining.length === 0) return roadmap;

    const profile = await this.profiles.findByUserOrThrow(userId);
    const input: RoadmapBlueprintInput = {
      fullName: profile.fullName,
      mainGoal: roadmap.goal || profile.mainGoal,
      currentSkillLevel: profile.currentSkillLevel,
      currentSkills: profile.currentSkills,
      weakAreas: profile.weakAreas,
      availableTimePerDay: profile.availableTimePerDay,
      targetTimeline: profile.targetTimeline,
      preferredLearningStyle: profile.preferredLearningStyle,
      careerTarget: profile.careerTarget,
    };
    const adjustment =
      note?.trim() ||
      'Adaptive re-plan: my pace has slipped — make this week tighter and more achievable in the time I actually have.';

    for (const week of remaining) {
      const newWeek = await this.roadmapAgent.regenerateWeek(
        userId,
        input,
        week,
        adjustment,
      );
      const idx = roadmap.weeklyPlan.findIndex(
        (w) => w.weekNumber === week.weekNumber,
      );
      roadmap.weeklyPlan[idx] = { ...newWeek, weekNumber: week.weekNumber };
      roadmap.completedTasks = roadmap.completedTasks.filter(
        (t) => !t.startsWith(`w${week.weekNumber}:`),
      );
    }
    roadmap.markModified('weeklyPlan');
    roadmap.progressPercentage = this.computeProgress(roadmap);
    this.logActivity(
      roadmap,
      'week',
      `Re-planned ${remaining.length} upcoming week${remaining.length === 1 ? '' : 's'}`,
    );
    const saved = await roadmap.save();
    await this.snapshot(
      saved,
      `Adaptive re-plan (${remaining.length} week${remaining.length === 1 ? '' : 's'})`,
    );
    return saved;
  }

  // ───────────────────────── versions (git-style history) ─────────────────────────

  /** Version summaries, newest first. v(latest) is what the roadmap holds now. */
  async listVersions(
    userId: string,
    id: string,
  ): Promise<RoadmapVersionSummary[]> {
    await this.findByIdForUser(userId, id); // ownership gate
    const docs = await this.versions
      .find({ roadmap: new Types.ObjectId(id) })
      .sort({ version: -1 })
      .lean()
      .exec();
    return docs.map((v, i) => ({
      version: v.version,
      label: v.label,
      createdAt: v.createdAt?.toISOString() ?? '',
      weeks: v.weeklyPlan?.length ?? 0,
      current: i === 0,
    }));
  }

  /**
   * Restore the roadmap's content to an earlier version. Progress survives:
   * completed weeks/tasks are kept where they still exist in the restored plan,
   * then progress is recomputed. The restore itself becomes a new version, so
   * nothing in history is ever lost (exactly like reverting a commit).
   */
  async restoreVersion(
    userId: string,
    id: string,
    version: number,
  ): Promise<RoadmapDocument> {
    const roadmap = await this.findByIdForUser(userId, id);
    const snap = await this.versions
      .findOne({ roadmap: roadmap._id, version })
      .lean()
      .exec();
    if (!snap) throw new NotFoundException(`Version ${version} not found`);

    for (const field of CONTENT_FIELDS) {
      // Same shapes by construction — versions are created from this document.
      (roadmap as unknown as Record<string, unknown>)[field] = snap[field];
    }
    roadmap.markModified('weeklyPlan');
    roadmap.markModified('milestones');

    // Keep only progress that still points at real weeks/tasks in this version.
    const weekNumbers = new Set(roadmap.weeklyPlan.map((w) => w.weekNumber));
    roadmap.completedWeeks = roadmap.completedWeeks.filter((w) =>
      weekNumbers.has(w),
    );
    roadmap.completedTasks = roadmap.completedTasks.filter((t) => {
      const m = /^w(\d+):t(\d+)$/.exec(t);
      if (!m) return false;
      const wk = roadmap.weeklyPlan.find((w) => w.weekNumber === Number(m[1]));
      return !!wk && Number(m[2]) < wk.tasks.length;
    });
    roadmap.progressPercentage = this.computeProgress(roadmap);
    if (
      roadmap.status === RoadmapStatus.Completed &&
      roadmap.progressPercentage < 100
    ) {
      roadmap.status = RoadmapStatus.Active;
    }
    this.logActivity(roadmap, 'week', `Restored to version ${version}`);
    const saved = await roadmap.save();
    await this.snapshot(saved, `Restored to v${version} (${snap.label})`);
    return saved;
  }

  /** Append a content snapshot as the next version; keep the newest MAX_VERSIONS. */
  private async snapshot(
    roadmap: RoadmapDocument,
    label: string,
  ): Promise<void> {
    const latest = await this.versions
      .findOne({ roadmap: roadmap._id })
      .sort({ version: -1 })
      .lean()
      .exec();
    const version = (latest?.version ?? 0) + 1;
    await this.versions.create({
      roadmap: roadmap._id,
      user: roadmap.user,
      version,
      label,
      title: roadmap.title,
      goal: roadmap.goal,
      overview: roadmap.overview,
      estimatedDuration: roadmap.estimatedDuration,
      difficulty: roadmap.difficulty,
      weeklyPlan: roadmap.weeklyPlan,
      milestones: roadmap.milestones,
      recommendedProjects: roadmap.recommendedProjects,
      assessmentPlan: roadmap.assessmentPlan,
      dailyStudyPlan: roadmap.dailyStudyPlan,
      successTips: roadmap.successTips,
    });
    if (version > MAX_VERSIONS) {
      await this.versions
        .deleteMany({
          roadmap: roadmap._id,
          version: { $lte: version - MAX_VERSIONS },
        })
        .exec();
    }
  }

  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateRoadmapStatusDto,
  ): Promise<RoadmapDocument> {
    const roadmap = await this.findByIdForUser(userId, id);
    // Re-activating a roadmap archives other actives to keep "active" singular.
    if (dto.status === RoadmapStatus.Active) {
      await this.model
        .updateMany(
          {
            user: roadmap.user,
            status: RoadmapStatus.Active,
            _id: { $ne: roadmap._id },
          },
          { status: RoadmapStatus.Archived },
        )
        .exec();
    }
    roadmap.status = dto.status;
    return roadmap.save();
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const roadmap = await this.findByIdForUser(userId, id);
    // Soft delete: archive rather than destroy, so history is preserved.
    roadmap.status = RoadmapStatus.Archived;
    await roadmap.save();
    return { ok: true };
  }

  /** Append a completion event, keeping only the most recent 80. */
  private logActivity(
    roadmap: RoadmapDocument,
    kind: 'week' | 'task',
    label: string,
  ): void {
    roadmap.activity = [
      ...(roadmap.activity ?? []),
      { at: new Date(), kind, label },
    ].slice(-80);
  }

  /** Resolve a "w{week}:t{index}" task id to the actual task text when possible. */
  private taskLabel(roadmap: RoadmapDocument, taskId: string): string {
    const m = /^w(\d+):t(\d+)$/.exec(taskId);
    if (!m) return taskId;
    const wk = roadmap.weeklyPlan.find((w) => w.weekNumber === Number(m[1]));
    return wk?.tasks[Number(m[2])] ?? taskId;
  }

  private computeProgress(roadmap: RoadmapDocument): number {
    const totalWeeks = roadmap.weeklyPlan.length;
    if (totalWeeks === 0) return 0;
    return Math.round((roadmap.completedWeeks.length / totalWeeks) * 100);
  }

  private assertOwner(roadmap: RoadmapDocument, userId: string): void {
    if (roadmap.user.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this roadmap');
    }
  }
}
