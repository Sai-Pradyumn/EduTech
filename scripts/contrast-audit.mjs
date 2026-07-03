#!/usr/bin/env node
/**
 * WCAG contrast audit for the OKLCH design tokens (Accessibility backlog · P2·M).
 * Parses the real token values out of client/src/styles.css (both the light `:root`
 * and the `:root[data-theme='dark']` ramp), converts OKLCH → linear sRGB → WCAG
 * relative luminance, and checks the text-on-surface pairs the UI actually uses.
 *
 *   node scripts/contrast-audit.mjs        # report + exit non-zero on a failure
 *
 * Floors: primary body/ink text must clear AA normal (4.5:1); soft/muted text,
 * which the UI only uses at ≥16px for secondary content, must clear AA large (3:1).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(root, 'client', 'src', 'styles.css'), 'utf8');

/** Extract `--name: oklch(L C H);` declarations from a single CSS block. */
function parseBlock(source, startRe) {
  const start = source.search(startRe);
  if (start < 0) return {};
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const block = source.slice(open + 1, end);
  const tokens = {};
  const re = /--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  let m;
  while ((m = re.exec(block))) {
    tokens[m[1]] = { L: +m[2], C: +m[3], H: +m[4] };
  }
  return tokens;
}

const light = parseBlock(css, /:root\s*\{/);
const dark = parseBlock(css, /:root\[data-theme='dark'\]\s*\{/);

/** OKLCH → linear sRGB (Björn Ottosson's OKLab matrices). */
function oklchToLinear({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
}

/** WCAG relative luminance from linear-sRGB channels. */
function luminance(tok) {
  const [r, g, b] = oklchToLinear(tok);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// fg token · bg token · floor (4.5 = AA normal, 3 = AA large/secondary)
const PAIRS = [
  ['text', 'paper', 4.5],
  ['text', 'paper-2', 4.5],
  ['text', 'paper-3', 4.5],
  ['text-soft', 'paper', 4.5],
  ['text-soft', 'paper-2', 3],
  ['text-mute', 'paper', 4.5],
  ['text-mute', 'paper-2', 3],
  ['text-mute', 'paper-3', 3],
  ['on-ink', 'ink', 4.5],
  ['on-ink', 'ink-2', 4.5],
  ['on-ink-soft', 'ink', 3],
  ['on-ink-mute', 'ink', 3],
  ['on-ink-mute', 'ink-2', 3],
];

let failures = 0;
for (const [theme, tokens] of [
  ['light', light],
  ['dark', dark],
]) {
  console.log(`\n${theme.toUpperCase()} theme`);
  for (const [fg, bg, floor] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) continue;
    const r = ratio(tokens[fg], tokens[bg]);
    const ok = r >= floor;
    if (!ok) failures++;
    const tag = r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large' : 'FAIL';
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${fg} on ${bg}: ${r.toFixed(2)}:1 (floor ${floor}, ${tag})`,
    );
  }
}

console.log(
  `\n${failures === 0 ? 'PASS — all audited token pairs meet their floor.' : `${failures} pair(s) below floor.`}`,
);
process.exit(failures === 0 ? 0 : 1);
