/** Project Studio models — mirror the server projects contract. */
import type { Difficulty } from './roadmap.model';

export type ProjectStatus = 'planning' | 'in_progress' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  order: number;
  phase: string;
  estimateHours: number;
}

export interface ProjectMilestone {
  title: string;
  description: string;
  criteria: string[];
  reached: boolean;
}

export interface ProjectSubmission {
  githubUrl?: string;
  demoUrl?: string;
  videoUrl?: string;
  notes: string;
  submittedAt?: string;
}

export interface ReviewChecklistItem {
  id: string;
  text: string;
  severity: 'high' | 'medium' | 'low';
  done: boolean;
}

/** Automated AI review of a submitted project (Phase 4 · B8). */
export interface AiProjectReview {
  qualityScore: number;
  architectureScore: number;
  completenessScore: number;
  resumeScore: number;
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: ReviewChecklistItem[];
  model: string;
  reviewedAt: string;
}

export interface MentorReviewView {
  reviewerName?: string;
  decision: 'approved' | 'changes_requested';
  feedback: string;
  score?: number;
  reviewedAt: string;
}

export interface Project {
  id: string;
  title: string;
  goal: string;
  summary: string;
  techStack: string[];
  features: string[];
  learningGoals: string[];
  difficulty: Difficulty;
  estimatedWeeks: number;
  status: ProjectStatus;
  source: string;
  progressPercentage: number;
  tasks: ProjectTask[];
  milestones: ProjectMilestone[];
  submission: ProjectSubmission | null;
  aiReview: AiProjectReview | null;
  mentorReview: MentorReviewView | null;
  /** Portfolio-ready case study (Phase 9) — empty until generated. */
  caseStudy: string;
  /** Archived projects stay in history but are hidden from the active board by default. */
  archived: boolean;
  createdAt: string;
}

/** Aggregate counts across all of a learner's projects. */
export interface ProjectStats {
  total: number;
  completed: number;
  inProgress: number;
  submitted: number;
  avgProgress: number;
}

export interface GenerateProjectRequest {
  goal: string;
  difficulty?: Difficulty;
}

export interface SubmitProjectRequest {
  githubUrl?: string;
  demoUrl?: string;
  videoUrl?: string;
  notes?: string;
}
