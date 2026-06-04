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
