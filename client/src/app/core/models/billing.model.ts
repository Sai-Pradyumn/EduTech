/** Billing & metering (B5/B6) — mirrors server contracts. */
export type PlanId = 'free' | 'pro' | 'team';

export interface Plan {
  id: PlanId;
  name: string;
  priceInr: number;
  aiCallsPerMonth: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export interface SubscriptionView {
  planId: PlanId;
  plan: Plan;
  status: string;
  startedAt: string;
  currentPeriodEnd?: string;
}

export interface UsageView {
  planId: PlanId;
  aiCalls: number;
  aiLimit: number;
  tokens: number;
  costUsd: number;
  periodStart: string;
  overLimit: boolean;
}

export interface TransactionView {
  id: string;
  planId: string;
  amountInr: number;
  status: string;
  reference: string;
  createdAt: string;
}
