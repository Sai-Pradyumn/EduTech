/** Enterprise report models (Phase 4 · B16) — mirror the server reports contract. */
export interface StudentOutcomeRow {
  userId: string;
  name: string;
  email: string;
  health: number;
  readiness: number;
  quizzes: number;
  projects: number;
  activeDays: number;
  topWeakness: string;
}

export interface StudentOutcomesReport {
  generatedAt: string;
  organizationId: string;
  studentCount: number;
  avgHealth: number;
  avgReadiness: number;
  rows: StudentOutcomeRow[];
}

export interface WeakTopicRow {
  topic: string;
  affectedStudents: number;
  avgSeverity: number;
}

export interface AiUsageRow {
  agentType: string;
  count: number;
}

export interface AiUsageReport {
  generatedAt: string;
  totalCalls: number;
  totalTokens: number;
  avgLatencyMs: number;
  rows: AiUsageRow[];
}
