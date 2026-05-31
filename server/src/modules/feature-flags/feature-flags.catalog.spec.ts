import { FEATURE_FLAG_DEFS, FEATURE_FLAG_KEYS, flagDef } from './feature-flags.catalog';

/** Feature-flag catalog invariants (Phase 10 · M16). Pure logic — no DB. */
describe('feature-flag catalog', () => {
  it('has unique keys', () => {
    expect(new Set(FEATURE_FLAG_KEYS).size).toBe(FEATURE_FLAG_KEYS.length);
  });

  it('keeps the live payment provider off by default', () => {
    expect(flagDef('ENABLE_PAYMENT_PROVIDER')?.defaultEnabled).toBe(false);
  });

  it('marks at least one AI path as killable', () => {
    expect(FEATURE_FLAG_DEFS.some((f) => f.killable)).toBe(true);
  });

  it('returns undefined for an unknown flag', () => {
    expect(flagDef('NOPE')).toBeUndefined();
  });
});
