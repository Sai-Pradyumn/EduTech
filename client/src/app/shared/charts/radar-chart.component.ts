import { AfterViewInit, ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ChartDatum, ChartTone, TONE_VAR, TONE_DEEP_VAR, clamp, polar } from './chart-utils';

/**
 * `asta-radar-chart` — multi-axis profile (skill radar). Each datum is an axis
 * with a 0–`max` value. Token-driven, concentric grid, draw-in (scale, reduced-
 * motion-safe), vertex dots + labels, a11y. Square; scales to `size`.
 */
@Component({
  selector: 'asta-radar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.length < 3) {
      <div class="empty" [style.height.px]="size">Need ≥3 axes</div>
    } @else {
      <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" [attr.width]="size" [attr.height]="size"
        role="img" [attr.aria-label]="ariaLabel || label">
        <!-- grid rings -->
        @for (g of rings; track g) {
          <polygon [attr.points]="gridPoints(g)" fill="none" stroke="var(--paper-3)" stroke-width="1" />
        }
        <!-- spokes + labels -->
        @for (a of axes(); track a.i) {
          <line [attr.x1]="c" [attr.y1]="c" [attr.x2]="a.ox" [attr.y2]="a.oy" stroke="var(--paper-3)" stroke-width="1" />
          <text [attr.x]="a.lx" [attr.y]="a.ly" [attr.text-anchor]="a.anchor" class="lbl">{{ a.label }}</text>
        }
        <!-- value polygon -->
        <polygon [attr.points]="valuePoints()" [attr.fill]="col" fill-opacity="0.18" [attr.stroke]="colDeep"
          stroke-width="2" stroke-linejoin="round" class="poly" [style.transform-origin]="c + 'px ' + c + 'px'" />
        @for (a of axes(); track a.i) {
          <circle [attr.cx]="a.vx" [attr.cy]="a.vy" r="3" [attr.fill]="colDeep" class="poly" [style.transform-origin]="c + 'px ' + c + 'px'" />
        }
      </svg>
    }
  `,
  styles: [
    `
      :host { display: inline-block; }
      .empty { display: grid; place-items: center; color: var(--text-mute); font-family: var(--mono); font-size: 12px; }
      .lbl { fill: var(--text-soft); font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
      .poly { animation: pop 0.7s var(--ease-spring) both; }
      @keyframes pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .poly { animation: none; } }
    `,
  ],
})
export class RadarChartComponent implements AfterViewInit {
  @Input() data: ChartDatum[] = [];
  @Input() max = 100;
  @Input() size = 220;
  @Input() tone: ChartTone = 'green';
  @Input() label = 'Profile';
  @Input() ariaLabel = '';

  readonly rings = [0.25, 0.5, 0.75, 1];
  readonly drawn = signal(false);

  get c(): number { return this.size / 2; }
  get rad(): number { return this.size / 2 - 26; }
  get col(): string { return TONE_VAR[this.tone]; }
  get colDeep(): string { return TONE_DEEP_VAR[this.tone]; }

  readonly axes = computed(() => {
    const n = this.data.length;
    return this.data.map((d, i) => {
      const deg = (360 / n) * i;
      const [ox, oy] = polar(this.c, this.c, this.rad, deg);
      const [lx, ly] = polar(this.c, this.c, this.rad + 12, deg);
      const frac = clamp(d.value / (this.max || 1), 0, 1);
      const [vx, vy] = polar(this.c, this.c, this.rad * frac, deg);
      const anchor = Math.abs(lx - this.c) < 6 ? 'middle' : lx > this.c ? 'start' : 'end';
      return { i, label: d.label, ox, oy, lx, ly: ly + 3, vx, vy, anchor };
    });
  });

  gridPoints(scale: number): string {
    const n = this.data.length || 3;
    return Array.from({ length: n }, (_, i) => {
      const [x, y] = polar(this.c, this.c, this.rad * scale, (360 / n) * i);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  valuePoints(): string {
    return this.axes().map((a) => `${a.vx.toFixed(1)},${a.vy.toFixed(1)}`).join(' ');
  }

  ngAfterViewInit(): void {
    this.drawn.set(true);
  }
}
