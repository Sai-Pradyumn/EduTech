/** Billing, metering & entitlements (B5/B6 → Phase 10 · M1) — mirrors server contracts. */
export type PlanId = 'free' | 'pro' | 'team' | 'institution' | 'enterprise';

export type FeatureKey =
  | 'ai.messages'
  | 'ai.tokens'
  | 'rag.documents'
  | 'flow.generations'
  | 'visual.generations'
  | 'voice.minutes'
  | 'simulation.sessions'
  | 'quiz.generations'
  | 'project.reviews'
  | 'portfolio.public'
  | 'org.members'
  | 'org.cohorts'
  | 'org.mentorSeats'
  | 'org.adminSeats'
  | 'certificate.issuance'
  | 'api.keys'
  | 'feature.export'
  | 'feature.advancedAnalytics'
  | 'feature.marketplacePublish'
  | 'feature.whiteLabel';

export interface Plan {
  id: PlanId;
  name: string;
  scope: 'user' | 'org';
  priceInr: number;
  priceYearlyInr: number;
  aiCallsPerMonth: number;
  tagline: string;
  features: string[];
  limits: Record<FeatureKey, number>;
  highlight?: boolean;
  isPublic: boolean;
}

export interface SubscriptionView {
  planId: PlanId;
  plan: Plan;
  status: string;
  startedAt: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  provider: string;
}

export interface UsageView {
  planId: PlanId;
  aiCalls: number;
  aiLimit: number;
  tokens: number;
  costUsd: number;
  periodStart: string;
  overLimit: boolean;
  byFeature: { feature: string; calls: number; costUsd: number }[];
}

export interface TransactionView {
  id: string;
  planId: string;
  amountInr: number;
  status: string;
  reference: string;
  provider: string;
  createdAt: string;
}

/** Entitlement check for one feature (mirrors EntitlementCheck). */
export interface EntitlementCheck {
  featureKey: FeatureKey;
  allowed: boolean;
  used: number;
  limit: number; // -1 unlimited, 0 blocked
  remaining: number;
  resetAt: string;
  reason?: 'ok' | 'hard_limit' | 'blocked';
}

export interface EntitlementSummary {
  planId: PlanId;
  planName: string;
  scope: 'user' | 'org';
  features: EntitlementCheck[];
}

/** Resolved feature flag (admin view). */
export interface FeatureFlagView {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  allowedPlans: string[];
  killable: boolean;
  beta?: boolean;
  overridden: boolean;
}

export interface AdminBillingOverview {
  totalAccounts: number;
  paidAccounts: number;
  mrrInr: number;
  byPlan: { planId: string; name: string; count: number; priceInr: number }[];
  paidTransactions: number;
}

/** Human labels for feature keys (client-side mirror for meters/gates). */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  'ai.messages': 'AI messages',
  'ai.tokens': 'AI tokens',
  'rag.documents': 'Knowledge documents',
  'flow.generations': 'Flow generations',
  'visual.generations': 'Visual generations',
  'voice.minutes': 'Voice minutes',
  'simulation.sessions': 'Simulation sessions',
  'quiz.generations': 'Quiz generations',
  'project.reviews': 'Project reviews',
  'portfolio.public': 'Public portfolio',
  'org.members': 'Org members',
  'org.cohorts': 'Cohorts',
  'org.mentorSeats': 'Mentor seats',
  'org.adminSeats': 'Admin seats',
  'certificate.issuance': 'Certificates / month',
  'api.keys': 'API keys',
  'feature.export': 'Data export',
  'feature.advancedAnalytics': 'Advanced analytics',
  'feature.marketplacePublish': 'Marketplace publishing',
  'feature.whiteLabel': 'White-label branding',
};
