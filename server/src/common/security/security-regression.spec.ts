import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Static security-regression gate (SECURITY_IMPLEMENTATION.md §23 · secure code review,
 * automated). Walks the server AND client source trees and fails the suite if a banned
 * dangerous sink appears outside its explicit allowlist. This turns "we don't use eval /
 * bypassSecurityTrust" from a convention into a build-breaking invariant: any NEW use
 * must be consciously allowlisted here, which forces the security conversation in review.
 */

const SERVER_SRC = join(__dirname, '..', '..');
const CLIENT_SRC = join(__dirname, '..', '..', '..', '..', 'client', 'src');

interface BannedPattern {
  name: string;
  pattern: RegExp;
  /** Repo-relative path fragments where existing, reviewed usage is tolerated. */
  allow: string[];
}

const SERVER_BANNED: BannedPattern[] = [
  { name: 'eval()', pattern: /\beval\s*\(/, allow: [] },
  { name: 'new Function()', pattern: /new\s+Function\s*\(/, allow: [] },
  { name: 'child_process', pattern: /child_process/, allow: [] },
  {
    name: 'process.env outside config/scripts (config drift)',
    pattern: /process\.env\.JWT_SECRET/,
    allow: ['config/'],
  },
];

const CLIENT_BANNED: BannedPattern[] = [
  {
    name: 'bypassSecurityTrust*',
    pattern: /bypassSecurityTrust/,
    // Reviewed, sanitizer-fronted usages only. Adding a file here requires review.
    allow: [
      'features/visuals/visual-renderer.component.ts',
      'shared/pipes/markdown.pipe.ts',
    ],
  },
  { name: 'document.write()', pattern: /document\.write\s*\(/, allow: [] },
  { name: 'eval()', pattern: /\beval\s*\(/, allow: [] },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry) && !/\.spec\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

function findViolations(root: string, banned: BannedPattern[]): string[] {
  const violations: string[] = [];
  for (const file of walk(root)) {
    const rel = relative(root, file).replace(/\\/g, '/');
    const content = readFileSync(file, 'utf8');
    for (const rule of banned) {
      if (!rule.pattern.test(content)) continue;
      if (rule.allow.some((a) => rel.includes(a))) continue;
      violations.push(`${rel}: ${rule.name}`);
    }
  }
  return violations;
}

describe('security regression gate (static scan)', () => {
  it('server source contains no banned dangerous sinks', () => {
    expect(findViolations(SERVER_SRC, SERVER_BANNED)).toEqual([]);
  });

  it('client source contains no unreviewed dangerous sinks', () => {
    if (!existsSync(CLIENT_SRC)) return; // server-only checkout (e.g. sliced CI job)
    expect(findViolations(CLIENT_SRC, CLIENT_BANNED)).toEqual([]);
  });
});
