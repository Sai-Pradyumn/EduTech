import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';
import { ChartDatum, ChartTone, TONE_VAR, formatCompact } from './chart-utils';

const FALLBACK: ChartTone[] = ['green', 'peri', 'coral'];

/**
 * `asta-donut-chart` — proportion ring (plan mix, agent share). Token-driven
 * slices (per-datum tone or a cycling fallback), draw-in via dasharray transition
 * (reduced-motion-safe), hover highlight + tooltip, centre total, legend, a11y.
 */
@Component({
  selector: 'asta-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!total()) {
      <div class="empty" [style.minHeight.px]="size">No data yet</div>
    } @else {
      <div class="row">
        <div class="ring" [style.width.px]="size" [style.height.px]="size">
          <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" [attr.width]="size" [attr.height]="size"
            role="img" [attr.aria-label]="ariaLabel || label">
            <circle [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none" stroke="var(--paper-3)" [attr.stroke-width]="thickness" />
            @for (s of slices(); track s.i) {
              <circle [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none" [attr.stroke]="s.col"
                [attr.stroke-width]="hover() === s.i ? thickness + 3 : thickness" stroke-linecap="butt"
                [attr.stroke-dasharray]="(drawn() ? s.len : 0) + ' ' + circ"
                [attr.stroke-dashoffset]="-s.offset" [attr.transform]="'rotate(-90 ' + c + ' ' + c + ')'"
                class="seg" (pointerenter)="hover.set(s.i)" (pointerleave)="hover.set(-1)" />
            }
          </svg>
          <div class="center">
            <span class="cv">{{ hover() > -1 ? fmt(data[hover()].value) : fmt(total()) }}</span>
            <span class="cl">{{ hover() > -1 ? data[hover()].label : centerLabel }}</span>
          </div>
        </div>
        <ul class="legend">
          @for (s of slices(); track s.i) {
            <li (pointerenter)="hover.set(s.i)" (pointerleave)="hover.set(-1)" [class.on]="hover() === s.i">
              <span class="sw" [style.background]="s.col"></span>
              <span class="ll">{{ data[s.i].label }}</span>
              <span class="lp">{{ s.pct }}%</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [
    `
      .row { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
      .empty { display: grid; place-items: center; color: var(--text-mute); font-family: var(--mono); font-size: 12px; }
      .ring { position: relative; flex-shrink: 0; }
      .seg { transition: stroke-dasharray 0.8s var(--ease), stroke-width 0.15s; cursor: default; }
      @media (prefers-reduced-motion: reduce) { .seg { transition: stroke-width 0.15s; } }
      .center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; }
      .cv { font-family: var(--display); font-weight: 600; font-size: 22px; line-height: 1; }
      .cl { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-mute); margin-top: 3px; }
      .legend { display: flex; flex-direction: column; gap: 7px; min-width: 0; flex: 1; }
      .legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; border-radius: 8px; padding: 2px 4px; transition: background .15s; }
      .legend li.on { background: var(--paper-2); }
      .sw { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
      .ll { color: var(--text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
      .lp { font-family: var(--mono); font-size: 12px; color: var(--text); }
    `,
  ],
})
export class DonutChartComponent implements AfterViewInit {
  @Input() data: ChartDatum[] = [];
  @Input() size = 150;
  @Input() thickness = 18;
  @Input() centerLabel = 'Total';
  @Input() label = 'Donut chart';
  @Input() ariaLabel = '';
  @Input() format?: (v: number) => string;

  readonly hover = signal(-1);
  readonly drawn = signal(false);

  get c(): number { return this.size / 2; }
  get r(): number { return this.size / 2 - this.thickness / 2 - 1; }
  get circ(): number { return 2 * Math.PI * this.r; }

  readonly total = computed(() => this.data.reduce((s, d) => s + Math.max(0, d.value), 0));

  readonly slices = computed(() => {
    const t = this.total() || 1;
    let acc = 0;
    return this.data.map((d, i) => {
      const frac = Math.max(0, d.value) / t;
      const len = frac * this.circ;
      const offset = acc * this.circ;
      acc += frac;
      return { i, len, offset, pct: Math.round(frac * 100), col: TONE_VAR[d.tone ?? FALLBACK[i % FALLBACK.length]] };
    });
  });

  fmt(v: number): string {
    return this.format ? this.format(v) : formatCompact(v);
  }

  ngAfterViewInit(): void {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.drawn.set(true);
      return;
    }
    requestAnimationFrame(() => this.drawn.set(true));
  }
}
