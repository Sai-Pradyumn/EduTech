#!/usr/bin/env node
/**
 * Bakes the production API endpoints into the Angular build.
 *
 * Angular builds are static, so `apiBaseUrl` / `socketUrl` must be known at build time.
 * This script rewrites `src/environments/environment.ts` from environment variables, so
 * Vercel can point the frontend at the Render backend without code changes.
 *
 * Set in Vercel → Project → Settings → Environment Variables:
 *   API_BASE_URL = https://asta-api.onrender.com/api
 *   SOCKET_URL   = https://asta-api.onrender.com
 *
 * It is only invoked by the Vercel `buildCommand` (see vercel.json) — local `ng build`
 * leaves the committed environment.ts (localhost defaults) untouched. When the vars are
 * unset it falls back to localhost so the script is always safe to run.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'environments', 'environment.ts');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
const socketUrl = process.env.SOCKET_URL || 'http://localhost:3000';
const production =
  Boolean(process.env.API_BASE_URL) || process.env.NODE_ENV === 'production';

const contents = `// AUTO-GENERATED at build time by scripts/generate-env.mjs — do not edit by hand.
// Local source of truth lives in git; production values come from Vercel env vars.
export const environment = {
  production: ${production},
  apiBaseUrl: '${apiBaseUrl}',
  socketUrl: '${socketUrl}',
};
`;

writeFileSync(target, contents);
console.log(
  `[generate-env] wrote ${target}\n  apiBaseUrl=${apiBaseUrl}\n  socketUrl=${socketUrl}\n  production=${production}`,
);
