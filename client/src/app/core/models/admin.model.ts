/** Admin Command Center models (Phase 3 · A7) — mirror the server admin contract. */
export interface AgentAnalyticsRow {
  agentType: string;
  count: number;
  tokens: number;
  avgLatencyMs: number;
  estCostUsd: number;
}

export interface AdminAnalytics {
  totalCalls: number;
  totalTokens: number;
  avgLatencyMs: number;
  estCostUsd: number;
  byAgent: AgentAnalyticsRow[];
}

export interface AdminStudentRow {
  userId: string;
  name: string;
  email: string;
  goal: string;
  skillLevel: string;
  onboarded: boolean;
  health: number;
  readiness: number;
  quizzes: number;
  lastActiveAt?: string;
}

/** Admin browser rows (B1) — mirror server AdminService browse contracts. */
export interface AdminDocumentRow {
  id: string;
  title: string;
  owner: string;
  source: string;
  status: string;
  chunkCount: number;
  tokenCount: number;
  language: string;
  createdAt?: string;
}

export interface AdminRoadmapRow {
  id: string;
  title: string;
  goal: string;
  owner: string;
  status: string;
  progressPercentage: number;
  weeks: number;
  completedWeeks: number;
  createdAt?: string;
}

export interface AdminQuizRow {
  id: string;
  title: string;
  topic: string;
  owner: string;
  difficulty: string;
  source: string;
  questionCount: number;
  attemptCount: number;
  bestScore?: number;
  createdAt?: string;
}
