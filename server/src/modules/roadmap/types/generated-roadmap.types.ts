import { AssessmentKind, Difficulty } from '../../../common/enums';

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
  type: `${AssessmentKind}`;
  description: string;
}

export interface GeneratedRoadmap {
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
}
