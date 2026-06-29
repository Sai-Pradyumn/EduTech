import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ChartTone, TONE_VAR } from './chart-utils';

export interface CalDatum {
  /** ISO date (YYYY-MM-DD) or anything Date can parse. */
  date: string;
  value: number;
}

/**
 * `asta-calendar-heatmap` — GitHub-style activity calendar (study streak). Builds
 * week columns × 7 day rows for the trailing `weeks`, intensity = value/max on a
 * tone. Token-driven, hover tooltip, month labels, a11y. SVG, scales to width.
 */
@Component({
  selector: 'asta-calendar-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cal" (pointerleave)="tip.set(null)">
      <svg [attr.viewBox]="'0 0 ' + vw + ' ' + vh" width="100%" [attr.height]="vh"
        role="img" [attr.aria-label]="ariaLabel || (label + ': ' + total() + ' total')">
        @for (m of monthLabels(); track m.x) {
          <text [attr.x]="m.x" y="8" class="ml">{{ m.text }}</text>
        }
        @for (cell of cells(); track cell.k) {
          <rect [attr.x]="cell.x" [attr.y]="cell.y" [attr.width]="sz" [attr.height]="sz" rx="2.5"
            [attr.fill]="cell.col" (pointerenter)="tip.set(cell)" class="day"
            [style.animation-delay]="(cell.x / vw * 0.5) + 's'" />
        }
      </svg>
      @if (tip(); as tp) {
        <div class="tt"><span class="tv">{{ tp.v }}</span> · {{ tp.d }}</div>
      }
    </div>
  `,
  styles: [
    `
      .cal { position: relative; width: 100%; }
      .ml { fill: var(--text-mute); font-family: var(--mono); font-size: 7px; text-transform: uppercase; }
      .day { transition: transform .1s; animation: calDayIn .45s var(--ease) backwards; }
      @keyframes calDayIn { from { opacity: 0; } }
      .day:hover { transform: scale(1.15); transform-box: fill-box; transform-origin: center; }
      @media (prefers-reduced-motion: reduce) { .day { animation: none; } }
      .tt { position: absolute; top: -6px; left: 0; transform: translateY(-100%); background: var(--ink); color: var(--on-ink);
        padding: 4px 8px; border-radius: 7px; font-size: 11px; box-shadow: var(--shadow-md); pointer-events: none; white-space: nowrap; }
      .tv { font-weight: 600; }
    `,
  ],
})
export class CalendarHeatmapComponent {
  @Input() set data(v: CalDatum[]) {
    this._map = new Map(v.map((d) => [this.key(new Date(d.date)), d.value]));
    this._raw = v;
  }
  @Input() weeks = 26;
  @Input() tone: ChartTone = 'green';
  @Input() label = 'Activity';
  @Input() ariaLabel = '';

  private _map = new Map<string, number>();
  private _raw: CalDatum[] = [];
  readonly tip = signal<{ k: string; x: number; y: number; col: string; v: number; d: string } | null>(null);

  readonly sz = 13;
  readonly gap = 3;
  readonly topPad = 12;
  get colW(): number { return this.sz + this.gap; }
  get vw(): number { return this.weeks * this.colW; }
  get vh(): number { return this.topPad + 7 * this.colW; }

  readonly total = computed(() => this._raw.reduce((s, d) => s + d.value, 0));

  private get maxV(): number {
    return Math.max(1, ...this._raw.map((d) => d.value));
  }

  readonly cells = computed(() => {
    const out: { k: string; x: number; y: number; col: string; v: number; d: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // start on the Sunday `weeks-1` weeks before this week
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (this.weeks - 1) * 7);
    for (let wi = 0; wi < this.weeks; wi++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + wi * 7 + d);
        if (date > today) continue;
        const k = this.key(date);
        const v = this._map.get(k) ?? 0;
        const intensity = v > 0 ? Math.max(0.18, v / this.maxV) : 0;
        out.push({
          k,
          x: wi * this.colW,
          y: this.topPad + d * this.colW,
          col: v > 0 ? `color-mix(in oklch, ${TONE_VAR[this.tone]} ${Math.round(intensity * 100)}%, var(--paper-2))` : 'var(--paper-3)',
          v,
          d: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        });
      }
    }
    return out;
  });

  readonly monthLabels = computed(() => {
    const seen = new Set<number>();
    const labels: { x: number; text: string }[] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (this.weeks - 1) * 7);
    for (let wi = 0; wi < this.weeks; wi++) {
      const date = new Date(start);
      date.setDate(start.getDate() + wi * 7);
      const m = date.getMonth();
      if (!seen.has(m)) {
        seen.add(m);
        labels.push({ x: wi * this.colW, text: date.toLocaleDateString(undefined, { month: 'short' }) });
      }
    }
    return labels;
  });

  private key(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
}
