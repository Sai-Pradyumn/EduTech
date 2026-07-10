/**
 * Boot-time security gate (SECURITY_IMPLEMENTATION.md §12/§13 · secure defaults). A
 * production process refusing to start beats one that starts with dev secrets: forgotten
 * JWT_SECRET fallbacks are one of the most common real-world token-forgery causes. Called
 * from main.ts before listen(); pure + injectable for tests.
 */

export interface BootSecretInput {
  nodeEnv: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
}

export interface BootCheckResult {
  ok: boolean;
  problems: string[];
}

/** Known development fallback values that must never reach production. */
const DEV_SECRETS = new Set([
  'dev_access_secret',
  'dev_refresh_secret',
  'secret',
  'changeme',
  'change_me',
  'jwt_secret',
]);

const MIN_SECRET_LENGTH = 32;

export function checkProductionSecrets(
  input: BootSecretInput,
): BootCheckResult {
  const problems: string[] = [];
  const production = input.nodeEnv === 'production';
  if (!production) return { ok: true, problems };

  const check = (label: string, value: string) => {
    if (!value) {
      problems.push(`${label} is empty`);
      return;
    }
    if (DEV_SECRETS.has(value.toLowerCase())) {
      problems.push(`${label} is a known development fallback value`);
    }
    if (value.length < MIN_SECRET_LENGTH) {
      problems.push(
        `${label} is shorter than ${MIN_SECRET_LENGTH} characters — use a random 256-bit value`,
      );
    }
  };

  check('JWT_SECRET', input.jwtSecret);
  check('JWT_REFRESH_SECRET', input.jwtRefreshSecret);
  if (input.jwtSecret && input.jwtSecret === input.jwtRefreshSecret) {
    problems.push(
      'JWT_SECRET and JWT_REFRESH_SECRET are identical — a stolen access token could be replayed as a refresh token',
    );
  }

  return { ok: problems.length === 0, problems };
}
