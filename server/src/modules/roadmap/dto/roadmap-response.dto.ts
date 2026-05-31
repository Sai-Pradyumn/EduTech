import { Difficulty, RoadmapStatus } from '../../../common/enums';
import {
  RoadmapAssessment,
  RoadmapMilestone,
  RoadmapProject,
  RoadmapWeek,
} from '../types/generated-roadmap.types';
import { RoadmapDocument } from '../schemas/roadmap.schema';

export interface RoadmapResponse {
  id: string;
  userId: string;
  title: string;
  goal: string;
  overview: string;
  estimatedDuration: string;
  difficulty: `${Difficulty}`;
  weeklyPlan: RoadmapWeek[];
  milestones: RoadmapMilestone[];
  recommendedProjects: RoadmapProject[];
  assessmentPlan: RoadmapAssessment[];
  dailyStudyPlan: string[];
  successTips: string[];
  status: `${RoadmapStatus}`;
  progressPercentage: number;
  completedWeeks: number[];
  completedTasks: string[];
  createdAt: string;
  updatedAt: string;
}

/** Compact summary for list views and the dashboard. */
export interface RoadmapSummary {
  id: string;
  title: string;
  goal: string;
  difficulty: `${Difficulty}`;
  estimatedDuration: string;
  status: `${RoadmapStatus}`;
  progressPercentage: number;
  totalWeeks: number;
  completedWeeksCount: number;
  createdAt: string;
}

export function toRoadmapResponse(doc: RoadmapDocument): RoadmapResponse {
  const d = doc as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: doc.id as string,
    userId: doc.user.toString(),
    title: doc.title,
    goal: doc.goal,
    overview: doc.overview,
    estimatedDuration: doc.estimatedDuration,
    difficulty: doc.difficulty,
    weeklyPlan: doc.weeklyPlan,
    milestones: doc.milestones,
    recommendedProjects: doc.recommendedProjects,
    assessmentPlan: doc.assessmentPlan as unknown as RoadmapAssessment[],
    dailyStudyPlan: doc.dailyStudyPlan,
    successTips: doc.successTips,
    status: doc.status,
    progressPercentage: doc.progressPercentage,
    completedWeeks: doc.completedWeeks,
    completedTasks: doc.completedTasks,
    createdAt: d.createdAt?.toISOString(),
    updatedAt: d.updatedAt?.toISOString(),
  };
}

export function toRoadmapSummary(doc: RoadmapDocument): RoadmapSummary {
  const d = doc as unknown as { createdAt: Date };
  return {
    id: doc.id as string,
    title: doc.title,
    goal: doc.goal,
    difficulty: doc.difficulty,
    estimatedDuration: doc.estimatedDuration,
    status: doc.status,
    progressPercentage: doc.progressPercentage,
    totalWeeks: doc.weeklyPlan.length,
    completedWeeksCount: doc.completedWeeks.length,
    createdAt: d.createdAt?.toISOString(),
  };
}
