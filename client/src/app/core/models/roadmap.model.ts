/** Roadmap types, mirroring the server roadmap responses. */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type RoadmapStatus = 'active' | 'completed' | 'archived';
export type AssessmentType = 'quiz' | 'project' | 'interview' | 'assignment';

export interface RoadmapWeek {
  weekNumber: number;
  title: string;
  focus: string;
  topics: string[];
  tasks: string[];
  practiceItems: string[];
  expectedOutcome: string;
}

export interface RoadmapMilestone {
  title: string;
  description: string;
  targetWeek: number;
  completionCriteria: string[];
}

export interface RoadmapProject {
  title: string;
  description: string;
  difficulty: string;
  skillsCovered: string[];
}

export interface RoadmapAssessment {
  title: string;
  week: number;
  type: AssessmentType;
  description: string;
}

export interface RoadmapActivityEntry {
  at: string;
  kind: string;
  label: string;
}

export interface Roadmap {
  id: string;
  userId: string;
  title: string;
  goal: string;
  overview: string;
  estimatedDuration: string;
  difficulty: Difficulty;
  weeklyPlan: RoadmapWeek[];
  milestones: RoadmapMilestone[];
  recommendedProjects: RoadmapProject[];
  assessmentPlan: RoadmapAssessment[];
  dailyStudyPlan: string[];
  successTips: string[];
  status: RoadmapStatus;
  progressPercentage: number;
  completedWeeks: number[];
  completedTasks: string[];
  activity?: RoadmapActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapSummary {
  id: string;
  title: string;
  goal: string;
  difficulty: Difficulty;
  estimatedDuration: string;
  status: RoadmapStatus;
  progressPercentage: number;
  totalWeeks: number;
  completedWeeksCount: number;
  createdAt: string;
}

/** One git-style content snapshot in a roadmap's history. */
export interface RoadmapVersionSummary {
  version: number;
  label: string;
  createdAt: string;
  weeks: number;
  current: boolean;
}

export interface RoadmapWeekDiff {
  weekNumber: number;
  kind: 'added' | 'removed' | 'changed';
  focus: string;
  changes: string[];
}

/** What restoring a version would change, relative to the current plan. */
export interface RoadmapVersionDiff {
  version: number;
  label: string;
  createdAt: string;
  same: boolean;
  fields: string[];
  weeks: RoadmapWeekDiff[];
}

export interface GenerateRoadmapPayload {
  goal?: string;
  targetTimeline?: string;
  availableTimePerDay?: string;
}

export interface UpdateProgressPayload {
  weekNumber?: number;
  weekCompleted?: boolean;
  taskId?: string;
  taskCompleted?: boolean;
}
