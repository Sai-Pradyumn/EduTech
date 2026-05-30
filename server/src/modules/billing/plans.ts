/** Subscription plans (Phase 4 · B5/B6). Static catalog — mock payment mode is real;
 *  Razorpay/Stripe slot in behind the same checkout shape later. */

export type PlanId = 'free' | 'pro' | 'team';

export interface Plan {
  id: PlanId;
  name: string;
  priceInr: number; // monthly
  /** Soft monthly AI-call limit used by the usage meter. -1 = unlimited. */
  aiCallsPerMonth: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const PLAN_CATALOG: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceInr: 0,
    aiCallsPerMonth: 100,
    tagline: 'Start your path.',
    features: ['Personalized roadmap', 'AI tutor & doubt solver', 'Quizzes & projects', '100 AI requests / month'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceInr: 499,
    aiCallsPerMonth: 2000,
    tagline: 'For serious learners.',
    features: ['Everything in Free', 'Knowledge base (RAG) on your notes', 'Voice room & mock interviews', 'Certificates', '2,000 AI requests / month'],
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team',
    priceInr: 1999,
    aiCallsPerMonth: 10000,
    tagline: 'Colleges & cohorts.',
    features: ['Everything in Pro', 'Cohorts & leaderboards', 'Mentor ecosystem', 'Org analytics & reports', '10,000 AI requests / month'],
  },
];

export function planById(id: string): Plan {
  return PLAN_CATALOG.find((p) => p.id === id) ?? PLAN_CATALOG[0];
}
