import {
  FEATURE_KEYS,
  PLAN_CATALOG,
  higherPlan,
  isAllowed,
  limitFor,
  planById,
  planRank,
} from './plans';

/** Entitlement-plan invariants (Phase 10 · M1). Pure logic — no DB. */
describe('plans catalog', () => {
  it('exposes the five SaaS tiers', () => {
    expect(PLAN_CATALOG.map((p) => p.id)).toEqual([
      'free',
      'pro',
      'team',
      'institution',
      'enterprise',
    ]);
  });

  it('defines a limit for every feature key on every plan', () => {
    for (const plan of PLAN_CATALOG) {
      for (const key of FEATURE_KEYS) {
        expect(typeof plan.limits[key]).toBe('number');
      }
    }
  });

  it('free is more constrained than pro for AI messages', () => {
    expect(limitFor('free', 'ai.messages')).toBeLessThan(
      limitFor('pro', 'ai.messages'),
    );
  });

  it('enterprise is unlimited on AI messages', () => {
    expect(limitFor('enterprise', 'ai.messages')).toBe(-1);
    expect(isAllowed('enterprise', 'ai.messages')).toBe(true);
  });

  it('blocks org seats on individual plans', () => {
    expect(isAllowed('free', 'org.members')).toBe(false);
    expect(isAllowed('pro', 'org.members')).toBe(false);
    expect(isAllowed('team', 'org.members')).toBe(true);
  });

  it('falls back to free for an unknown plan id', () => {
    expect(planById('does-not-exist').id).toBe('free');
  });

  it('ranks plans by catalog tier order', () => {
    expect(planRank('free')).toBeLessThan(planRank('pro'));
    expect(planRank('team')).toBeLessThan(planRank('enterprise'));
  });

  it('org inheritance picks the higher tier (institution over a member free plan)', () => {
    expect(higherPlan('free', 'institution')).toBe('institution');
    expect(higherPlan('pro', 'free')).toBe('pro');
  });
});
