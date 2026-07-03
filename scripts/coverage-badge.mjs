#!/usr/bin/env node
/**
 * Self-contained coverage badge generator — no external service (shields.io) at
 * runtime. Reads the Jest `json-summary` output and writes a small SVG badge that
 * the README references. Run it after `npm run test:cov --workspace server`:
 *
 *   node scripts/coverage-badge.mjs
 *
 * CI regenerates coverage on every run and uploads the report as an artifact; the
 * committed badge reflects the last run committed to the repo.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Jest runs with rootDir=server/src and coverageDirectory=../coverage → server/coverage.
const summaryPath = resolve(root, 'server', 'coverage', 'coverage-summary.json');
// docs/ is git-ignored, so the committed badge lives under .github/.
const outPath = resolve(root, '.github', 'coverage-badge.svg');

let pct = 0;
try {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  pct = Math.round((summary.total?.lines?.pct ?? 0) * 10) / 10;
} catch {
  console.error(
    `coverage summary not found at ${summaryPath} — run "npm run test:cov --workspace server" first.`,
  );
  process.exit(1);
}

// Green ≥80, yellow-green ≥65, yellow ≥50, orange ≥35, red below.
const color =
  pct >= 80 ? '#3fb950'
  : pct >= 65 ? '#94d82d'
  : pct >= 50 ? '#d4b106'
  : pct >= 35 ? '#e8873a'
  : '#e5534b';

const label = 'coverage';
const value = `${pct}%`;
// Rough monospace-ish width estimate so the two halves size to their text.
const w = (s) => 6.2 * s.length + 10;
const lw = w(label);
const vw = w(value);
const total = lw + vw;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <rect rx="3" width="${total}" height="20" fill="#555"/>
  <rect rx="3" x="${lw}" width="${vw}" height="20" fill="${color}"/>
  <rect rx="3" width="${total}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${label}</text>
    <text x="${lw + vw / 2}" y="14">${value}</text>
  </g>
</svg>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, svg);
console.log(`coverage badge written: ${outPath} (${value} lines)`);
