import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoadmapStatus } from '../../../common/enums';
import { StudentProfileService } from '../../student-profile/student-profile.service';
import { Roadmap, RoadmapDocument } from '../../roadmap/schemas/roadmap.schema';
import { AgentMemoryService } from './agent-memory.service';
import { MemoryItem, RoadmapContext } from './agent.interface';
import { StudentProfileDocument } from '../../student-profile/schemas/student-profile.schema';

export interface LoadedContext {
  profile: StudentProfileDocument | null;
  roadmap: RoadmapContext | null;
  memories: MemoryItem[];
}

/**
 * Assembles the personalization context (profile + active roadmap + memory) for an
 * agent run. Reads the Roadmap model directly to avoid a module cycle with RoadmapModule.
 */
@Injectable()
export class AgentContextService {
  constructor(
    private readonly profiles: StudentProfileService,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    private readonly memory: AgentMemoryService,
  ) {}

  async load(userId: string, query?: string): Promise<LoadedContext> {
    const [profile, activeRoadmap, memories] = await Promise.all([
      this.profiles.findByUser(userId),
      this.roadmaps
        .findOne({
          user: new Types.ObjectId(userId),
          status: RoadmapStatus.Active,
        })
        .sort({ updatedAt: -1 })
        .exec(),
      this.memory.retrieve(userId, query),
    ]);

    let roadmap: RoadmapContext | null = null;
    if (activeRoadmap) {
      const currentWeek = activeRoadmap.weeklyPlan.find(
        (w) => !activeRoadmap.completedWeeks.includes(w.weekNumber),
      );
      roadmap = {
        id: activeRoadmap.id as string,
        title: activeRoadmap.title,
        goal: activeRoadmap.goal,
        progressPercentage: activeRoadmap.progressPercentage,
        currentWeekFocus: currentWeek?.focus,
        totalWeeks: activeRoadmap.weeklyPlan.length,
      };
    }

    return { profile, roadmap, memories };
  }
}
