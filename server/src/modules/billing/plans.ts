/**
 * Subscription plans + entitlement limits (Phase 4 · B5/B6 → upgraded Phase 10 · M1).
 *
 * Static catalog. Mock payment mode is real; Razorpay/Stripe slot in behind the same
 * checkout shape via the PaymentProvider abstraction. Every paid/limited capability is a
 * FeatureKey with a per-plan numeric limit (-1 = unlimited, 0 = blocked). The entitlements
 * module enforces these; this file is the single source of truth.
 */

export type PlanId = 'free' | 'pro' | 'team' | 'institution' | 'enterprise';

/** Feature keys metered/gated by the entitlement system. */
export type FeatureKey =
  | 'ai.messages' // AI chat / agent messages per month
  | 'ai.tokens' // total LLM tokens per month
  | 'rag.documents' // knowledge documents stored
  | 'flow.generations' // Flow Studio generations / month
  | 'visual.generations' // Visual Studio generations / month
  | 'voice.minutes' // voice room minutes / month
  | 'simulation.sessions' // simulation lab sessions / month
  | 'quiz.generations' // quiz generations / month
  | 'project.reviews' // AI project reviews / month
  | 'portfolio.public' // public profile / portfolio (1 = allowed)
  | 'org.members' // org member seats
  | 'org.cohorts' // cohorts
  | 'org.mentorSeats' // mentor seats
  | 'org.adminSeats' // admin seats
  | 'certificate.issuance' // certificates issued / month
  | 'api.keys' // developer API keys
  | 'feature.export' // data export (1 = allowed)
  | 'feature.advancedAnalytics' // advanced analytics (1 = allowed)
  | 'feature.marketplacePublish' // publish to marketplace (1 = allowed)
  | 'feature.whiteLabel'; // white-label / branding (1 = allowed)

export type LimitMap = Record<FeatureKey, number>;

/** All feature keys, in display order. */
export const FEATURE_KEYS: FeatureKey[] = [
  'ai.messages',
  'ai.tokens',
  'rag.documents',
  'flow.generations',
  'visual.generations',
  'voice.minutes',
  'simulation.sessions',
  'quiz.generations',
  'project.reviews',
  'portfolio.public',
  'org.members',
  'org.cohorts',
  'org.mentorSeats',
  'org.adminSeats',
  'certificate.issuance',
  'api.keys',
  'feature.export',
  'feature.advancedAnalytics',
  'feature.marketplacePublish',
  'feature.whiteLabel',
];

/** Human labels for meters / upgrade prompts. */
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

/** Reset cadence per feature. Monthly meters reset on the billing period; flags never reset. */
export const MONTHLY_FEATURES: FeatureKey[] = [
  'ai.messages',
  'ai.tokens',
  'flow.generations',
  'visual.generations',
  'voice.minutes',
  'simulation.sessions',
  'quiz.generations',
  'project.reviews',
  'certificate.issuance',
];

export interface Plan {
  id: PlanId;
  name: string;
  /** 'user' plans are bought by individuals; 'org' plans cover a whole organization. */
  scope: 'user' | 'org';
  priceInr: number; // monthly
  priceYearlyInr: number; // yearly (2 months free)
  /** Back-compat soft monthly AI-call limit (mirrors limits['ai.messages']). */
  aiCallsPerMonth: number;
  tagline: string;
  features: string[];
  limits: LimitMap;
  highlight?: boolean;
  isPublic: boolean;
}

const U = -1; // unlimited
const X = 0; // blocked

export const PLAN_CATALOG: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    scope: 'user',
    priceInr: 0,
    priceYearlyInr: 0,
    aiCallsPerMonth: 100,
    tagline: 'Start your path.',
    isPublic: true,
    features: [
      'Personalized roadmap',
      'AI tutor & doubt solver',
      'Quizzes & projects',
      '100 AI requests / month',
    ],
    limits: {
      'ai.messages': 100,
      'ai.tokens': 200_000,
      'rag.documents': 5,
      'flow.generations': 10,
      'visual.generations': 10,
      'voice.minutes': 15,
      'simulation.sessions': 5,
      'quiz.generations': 20,
      'project.reviews': 3,
      'portfolio.public': 1,
      'org.members': X,
      'org.cohorts': X,
      'org.mentorSeats': X,
      'org.adminSeats': X,
      'certificate.issuance': 1,
      'api.keys': X,
      'feature.export': 1,
      'feature.advancedAnalytics': X,
      'feature.marketplacePublish': X,
      'feature.whiteLabel': X,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    scope: 'user',
    priceInr: 499,
    priceYearlyInr: 4990,
    aiCallsPerMonth: 2000,
    tagline: 'For serious learners.',
    highlight: true,
    isPublic: true,
    features: [
      'Everything in Free',
      'Knowledge base (RAG) on your notes',
      'Voice room & mock interviews',
      'Certificates',
      '2,000 AI requests / month',
    ],
    limits: {
      'ai.messages': 2000,
      'ai.tokens': 4_000_000,
      'rag.documents': 100,
      'flow.generations': 200,
      'visual.generations': 200,
      'voice.minutes': 300,
      'simulation.sessions': 100,
      'quiz.generations': 500,
      'project.reviews': 50,
      'portfolio.public': 1,
      'org.members': X,
      'org.cohorts': X,
      'org.mentorSeats': X,
      'org.adminSeats': X,
      'certificate.issuance': 20,
      'api.keys': 2,
      'feature.export': 1,
      'feature.advancedAnalytics': 1,
      'feature.marketplacePublish': 1,
      'feature.whiteLabel': X,
    },
  },
  {
    id: 'team',
    name: 'Team',
    scope: 'org',
    priceInr: 1999,
    priceYearlyInr: 19990,
    aiCallsPerMonth: 10000,
    tagline: 'Colleges & cohorts.',
    isPublic: true,
    features: [
      'Everything in Pro',
      'Cohorts & leaderboards',
      'Mentor ecosystem',
      'Org analytics & reports',
      '10,000 AI requests / month',
    ],
    limits: {
      'ai.messages': 10000,
      'ai.tokens': 20_000_000,
      'rag.documents': 1000,
      'flow.generations': 2000,
      'visual.generations': 2000,
      'voice.minutes': 3000,
      'simulation.sessions': 1000,
      'quiz.generations': 5000,
      'project.reviews': 500,
      'portfolio.public': 1,
      'org.members': 50,
      'org.cohorts': 20,
      'org.mentorSeats': 10,
      'org.adminSeats': 5,
      'certificate.issuance': 200,
      'api.keys': 10,
      'feature.export': 1,
      'feature.advancedAnalytics': 1,
      'feature.marketplacePublish': 1,
      'feature.whiteLabel': X,
    },
  },
  {
    id: 'institution',
    name: 'Institution',
    scope: 'org',
    priceInr: 7999,
    priceYearlyInr: 79990,
    aiCallsPerMonth: 50000,
    tagline: 'Universities & academies.',
    isPublic: true,
    features: [
      'Everything in Team',
      'Up to 500 members',
      'Institution reports & branding',
      'White-label certificates',
      'Developer API & webhooks',
    ],
    limits: {
      'ai.messages': 50000,
      'ai.tokens': 100_000_000,
      'rag.documents': 10000,
      'flow.generations': U,
      'visual.generations': U,
      'voice.minutes': 20000,
      'simulation.sessions': U,
      'quiz.generations': U,
      'project.reviews': 5000,
      'portfolio.public': 1,
      'org.members': 500,
      'org.cohorts': 100,
      'org.mentorSeats': 50,
      'org.adminSeats': 20,
      'certificate.issuance': 2000,
      'api.keys': 50,
      'feature.export': 1,
      'feature.advancedAnalytics': 1,
      'feature.marketplacePublish': 1,
      'feature.whiteLabel': 1,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    scope: 'org',
    priceInr: 0, // custom / contact sales
    priceYearlyInr: 0,
    aiCallsPerMonth: -1,
    tagline: 'Custom scale & SLAs.',
    isPublic: true,
    features: [
      'Everything in Institution',
      'Unlimited members & usage',
      'SSO / SCIM (placeholder)',
      'Custom AI budgets & SLAs',
      'Dedicated support',
    ],
    limits: {
      'ai.messages': U,
      'ai.tokens': U,
      'rag.documents': U,
      'flow.generations': U,
      'visual.generations': U,
      'voice.minutes': U,
      'simulation.sessions': U,
      'quiz.generations': U,
      'project.reviews': U,
      'portfolio.public': 1,
      'org.members': U,
      'org.cohorts': U,
      'org.mentorSeats': U,
      'org.adminSeats': U,
      'certificate.issuance': U,
      'api.keys': U,
      'feature.export': 1,
      'feature.advancedAnalytics': 1,
      'feature.marketplacePublish': 1,
      'feature.whiteLabel': 1,
    },
  },
];

export function planById(id: string): Plan {
  return PLAN_CATALOG.find((p) => p.id === id) ?? PLAN_CATALOG[0];
}

export function limitFor(planId: string, key: FeatureKey): number {
  return planById(planId).limits[key] ?? 0;
}

/** Is a feature-flag-style capability (limit of 1 = allowed) granted by this plan? */
export function isAllowed(planId: string, key: FeatureKey): boolean {
  const v = limitFor(planId, key);
  return v === -1 || v > 0;
}
