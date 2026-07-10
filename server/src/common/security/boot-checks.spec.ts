import { checkProductionSecrets } from './boot-checks';

const STRONG_A = 'a-genuinely-long-random-secret-value-0123456789';
const STRONG_B = 'another-long-random-secret-value-9876543210-xyz';

describe('security/boot-checks', () => {
  it('passes anything outside production (dev must never be blocked)', () => {
    const result = checkProductionSecrets({
      nodeEnv: 'development',
      jwtSecret: 'dev_access_secret',
      jwtRefreshSecret: 'dev_refresh_secret',
    });
    expect(result.ok).toBe(true);
  });

  it('passes strong distinct secrets in production', () => {
    const result = checkProductionSecrets({
      nodeEnv: 'production',
      jwtSecret: STRONG_A,
      jwtRefreshSecret: STRONG_B,
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it('fails production boot on dev fallback secrets', () => {
    const result = checkProductionSecrets({
      nodeEnv: 'production',
      jwtSecret: 'dev_access_secret',
      jwtRefreshSecret: STRONG_B,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/development fallback/);
  });

  it('fails production boot on short or empty secrets', () => {
    const short = checkProductionSecrets({
      nodeEnv: 'production',
      jwtSecret: 'tiny',
      jwtRefreshSecret: STRONG_B,
    });
    expect(short.ok).toBe(false);
    expect(short.problems.join(' ')).toMatch(/shorter than/);

    const empty = checkProductionSecrets({
      nodeEnv: 'production',
      jwtSecret: '',
      jwtRefreshSecret: STRONG_B,
    });
    expect(empty.ok).toBe(false);
  });

  it('fails when access and refresh secrets are identical', () => {
    const result = checkProductionSecrets({
      nodeEnv: 'production',
      jwtSecret: STRONG_A,
      jwtRefreshSecret: STRONG_A,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/identical/);
  });
});
