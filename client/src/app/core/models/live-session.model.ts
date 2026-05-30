/** Live session models (Phase 4 · B4) — mirror the server live-sessions contract. */
export type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface SessionView {
  id: string;
  organizationId: string;
  cohortId?: string;
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  scheduledStart: string;
  durationMins: number;
  status: LiveSessionStatus;
  meetingUrl: string;
  attendeeCount: number;
}

export interface SessionRecap {
  summary: string;
  keyPoints: string[];
  assignmentTitle: string;
  assignmentDescription: string;
  suggestedQuizTopic: string;
  generatedAt?: string;
}

export interface SessionAttendee {
  userId: string;
  name: string;
  joinedAt: string;
}

export interface SessionDetail extends SessionView {
  notes: string;
  attendees: SessionAttendee[];
  recap: SessionRecap | null;
}

export interface CreateSessionRequest {
  title: string;
  description?: string;
  cohortId?: string;
  scheduledStart: string;
  durationMins?: number;
}
