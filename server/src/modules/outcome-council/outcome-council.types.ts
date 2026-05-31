export interface CouncilAction {
  id: string;
  /** Which council member proposed it. */
  agent: string;
  action: string;
  why: string;
  /** 0–100 — how much this lifts real-world readiness right now. */
  expectedImpact: number;
  timeRequired: string;
  route: string;
  riskIfIgnored: string;
}

export interface CouncilResult {
  verdict: string;
  best: CouncilAction | null;
  alternatives: CouncilAction[];
  context: { role: string; readinessScore: number; band: string };
  generatedAt: string;
}
