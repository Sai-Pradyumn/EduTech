#!/usr/bin/env node
/**
 * Bakes the production API endpoints into the Angular build.
 *
 * Angular builds are static, so `apiBaseUrl` / `socketUrl` must be known at build time.
 * The production build (angular.json `fileReplacements`) swaps in `environment.prod.ts`,
 * so THIS is the file we must write — writing `environment.ts` would be ignored by a
 * production build. Vercel can thus point the frontend at the Render backend with no
 * code changes.
 *
 * Set in Vercel → Project → Settings → Environment Variables:
 *   API_BASE_URL = https://asta-api.onrender.com/api
 *   SOCKET_URL   = https://asta-api.onrender.com
 *
 * Only invoked by the Vercel `buildCommand` (see vercel.json). Local `ng serve` uses
 * the dev `environment.ts`; the Docker build ships the committed `environment.prod.ts`
 * (same-origin `/api`, proxied by nginx). When the vars are unset this writes those same
 * same-origin defaults, so it's always safe to run.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'environments', 'environment.prod.ts');

// Default to same-origin relative URLs (the nginx/Docker default). Vercel sets the
// absolute Render URLs to point the cross-origin frontend at the backend.
const apiBaseUrl = process.env.API_BASE_URL || '/api';
const socketUrl = process.env.SOCKET_URL ?? '';

const contents = `/**
 * AUTO-GENERATED at build time by scripts/generate-env.mjs — do not edit by hand.
 * Swapped in by angular.json \`fileReplacements\` for the production build. Defaults are
 * same-origin (nginx proxies \`/api\` and \`/socket.io\`); Vercel overrides with absolute
 * URLs via API_BASE_URL / SOCKET_URL.
 */
export const environment = {
  production: true,
  apiBaseUrl: '${apiBaseUrl}',
  socketUrl: '${socketUrl}',
};
`;

writeFileSync(target, contents);
console.log(
  `[generate-env] wrote ${target}\n  apiBaseUrl=${apiBaseUrl}\n  socketUrl=${socketUrl}`,
);
