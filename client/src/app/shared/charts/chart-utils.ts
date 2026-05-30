/**
 * Shared helpers for the in-house SVG chart kit (Workstream C). Pure functions —
 * no dependency, token-driven colors, locale-aware number formatting. All charts
 * use a fixed `viewBox` and `width:100%` so they scale responsively without a
 * ResizeObserver; tooltips map pointer position via the SVG bounding rect.
 */

/** Accent tone → CSS token. `accent` follows the active theme accent. */
export type ChartTone = 'green' | 'coral' | 'peri' | 'accent';

export const TONE_VAR: Record<ChartTone, string> = {
  green: 'var(--green)',
  coral: 'var(--coral)',
  peri: 'var(--peri)',
  accent: 'var(--accent)',
};
export const TONE_DEEP_VAR: Record<ChartTone, string> = {
  green: 'var(--green-deep)',
  coral: 'var(--coral-deep)',
  peri: 'var(--peri-deep)',
  accent: 'var(--accent-deep)',
};

/** A single labelled datum used by line/area/bar/donut/radar. */
export interface ChartDatum {
  label: string;
  value: number;
  /** Optional per-slice/-bar tone (donut, multi-tone bar). */
  tone?: ChartTone;
}

/** Clamp a number into [min,max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Locale-aware compact number format: 1234 → "1.2k", 2_500_000 → "2.5M".
 * Small/whole numbers pass through. Currency handled by the caller.
 */
export function formatCompact(n: number, locale = 'en'): string {
  if (!isFinite(n)) return '–';
  const abs = Math.abs(n);
  try {
    if (abs >= 1000) {
      return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: abs < 10 && !Number.isInteger(n) ? 1 : 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}

/** Build a polyline `points` string from x/y pixel pairs. */
export function pointsToPolyline(pts: ReadonlyArray<readonly [number, number]>): string {
  return pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
}

/** Build an SVG path `d` (M…L…) from x/y pixel pairs; optionally close to a baseline. */
export function linePath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (!pts.length) return '';
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join(' ');
}

/** Build a closed area path under a line down to `baselineY`. */
export function areaPath(pts: ReadonlyArray<readonly [number, number]>, baselineY: number): string {
  if (!pts.length) return '';
  const [fx] = pts[0];
  const [lx] = pts[pts.length - 1];
  return `${linePath(pts)} L${round(lx)} ${round(baselineY)} L${round(fx)} ${round(baselineY)} Z`;
}

/** Convert polar (deg, 0 = 12 o'clock, clockwise) to cartesian around a centre. */
export function polar(cx: number, cy: number, r: number, deg: number): readonly [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** SVG arc path between two angles (deg) at radius r around (cx,cy). */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(cx, cy, r, endDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M${round(sx)} ${round(sy)} A${r} ${r} 0 ${large} 0 ${round(ex)} ${round(ey)}`;
}

/** "Nice" upper bound for an axis (round to 1/2/5 × 10ⁿ) so ticks read cleanly. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const norm = max / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

/** Evenly spaced tick values from 0..max (inclusive), `count` segments. */
export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
