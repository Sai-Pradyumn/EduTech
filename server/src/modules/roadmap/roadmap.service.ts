import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Difficulty, RoadmapStatus } from '../../common/enums';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { RoadmapAgentService } from '../agents/roadmap/roadmap-agent.service';
import { RoadmapBlueprintInput } from '../agents/roadmap/roadmap-blueprint.generator';
import { Roadmap, RoadmapDocument } from './schemas/roadmap.schema';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';
import { UpdateRoadmapProgressDto } from './dto/update-roadmap-progress.dto';
import { UpdateRoadmapStatusDto } from './dto/update-roadmap-status.dto';

@Injectable()
export class RoadmapService {
  constructor(
    @InjectModel(Roadmap.name) private readonly model: Model<RoadmapDocument>,
    private readonly profiles: StudentProfileService,
    private readonly roadmapAgent: RoadmapAgentService,
  ) {}

  /** Generate from the student's profile (with optional goal/timeline/intensity overrides). */
  async generate(userId: string, dto: GenerateRoadmapDto): Promise<RoadmapDocument> {
    const profile = await this.profiles.findByUserOrThrow(userId);

    const input: RoadmapBlueprintInput = {
      fullName: profile.fullName,
      mainGoal: dto.goal?.trim() || profile.mainGoal,
      currentSkillLevel: profile.currentSkillLevel,
      currentSkills: profile.currentSkills,
      weakAreas: profile.weakAreas,
      availableTimePerDay: dto.availableTimePerDay ?? profile.availableTimePerDay,
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

    return this.model.create({
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
  }

  findMine(userId: string): Promise<RoadmapDocument[]> {
    return this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ status: 1, updatedAt: -1 })
      .exec();
  }

  findActive(userId: string): Promise<RoadmapDocument | null> {
    return this.model
      .findOne({ user: new Types.ObjectId(userId), status: RoadmapStatus.Active })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findByIdForUser(userId: string, id: string): Promise<RoadmapDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Roadmap not found');
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

    if (typeof dto.weekNumber === 'number' && typeof dto.weekCompleted === 'boolean') {
      const set = new Set(roadmap.completedWeeks);
      if (dto.weekCompleted) set.add(dto.weekNumber);
      else set.delete(dto.weekNumber);
      roadmap.completedWeeks = [...set].sort((a, b) => a - b);
    }

    if (dto.taskId && typeof dto.taskCompleted === 'boolean') {
      const set = new Set(roadmap.completedTasks);
      if (dto.taskCompleted) set.add(dto.taskId);
      else set.delete(dto.taskId);
      roadmap.completedTasks = [...set];
    }

    roadmap.progressPercentage = this.computeProgress(roadmap);
    if (roadmap.progressPercentage >= 100 && roadmap.status === RoadmapStatus.Active) {
      roadmap.status = RoadmapStatus.Completed;
    }
    return roadmap.save();
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
          { user: roadmap.user, status: RoadmapStatus.Active, _id: { $ne: roadmap._id } },
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
