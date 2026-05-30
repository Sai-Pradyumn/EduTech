/** Founder / operator dashboard model (Phase 4 · B17) — mirrors the server founder contract. */
export interface FounderDashboard {
  generatedAt: string;
  totals: {
    organizations: number;
    users: number;
    students: number;
    mentors: number;
    cohorts: number;
  };
  subscriptions: {
    active: number;
    estMrrInr: number;
    byPlan: { plan: string; count: number }[];
  };
  ai: {
    totalCalls: number;
    totalTokens: number;
    estCostUsd: number;
    byAgent: { agentType: string; count: number }[];
  };
  adoption: { feature: string; users: number; pct: number }[];
  topCohorts: { name: string; organization: string; students: number; mentors: number }[];
  signups: { date: string; count: number }[];
  churnRisk: { inactiveStudents: number; thresholdDays: number };
  systemHealth: { db: string; uptimeSec: number; memoryMb: number };
}
