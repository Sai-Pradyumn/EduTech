/** Cohort-based learning (B3) — mirrors the server cohort contracts. */

export type CohortStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface CohortView {
  id: string;
  organizationId: string;
  organizationName?: string;
  name: string;
  description: string;
  roadmapGoal: string;
  status: CohortStatus;
  startDate?: string;
  endDate?: string;
  mentorCount: number;
  studentCount: number;
  announcementCount: number;
}

export interface CohortMemberLite {
  userId: string;
  name: string;
  email: string;
}

export interface CohortAnnouncement {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface CohortDetail extends CohortView {
  mentors: CohortMemberLite[];
  students: CohortMemberLite[];
  announcements: CohortAnnouncement[];
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  health: number;
  readiness: number;
  activeDays: number;
}
