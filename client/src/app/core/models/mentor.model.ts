/** Mentor ecosystem models — mirror the server mentor contract (B2). */

export type Risk = 'high' | 'medium' | 'low';

export interface StudentSummary {
  userId: string;
  name: string;
  email: string;
  organizationName: string;
  health: number;
  readiness: number;
  risk: Risk;
  topWeakness: string | null;
  strengths: string[];
  activeDays: number;
  summary: string;
}

export interface PendingReview {
  projectId: string;
  title: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  githubUrl?: string;
  demoUrl?: string;
}

export interface MentorDashboard {
  students: StudentSummary[];
  atRiskCount: number;
  pendingReviews: PendingReview[];
  weeklyActions: string[];
}

export interface MentorNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface StudentDetail {
  summary: StudentSummary;
  notes: MentorNote[];
  projects: PendingReview[];
}

export interface MentorProfile {
  headline: string;
  bio: string;
  skills: string[];
  languages: string[];
  experienceYears: number;
  availability: string;
}
