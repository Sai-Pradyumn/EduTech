import { ChangeDetectionStrategy, Component, Input, computed } from '@angular/core';
import { ChartTone, TONE_VAR, areaPath, linePath } from './chart-utils';

/**
 * `asta-sparkline` — inline micro-trend (per-student health, card metrics). No
 * axes/labels; pure shape. Token-driven, optional area fill, draw-in
 * (reduced-motion-safe), `role="img"`. Fixed viewBox scaled to width/height.
 */
@Component({
  selector: 'asta-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width" [attr.height]="height" [attr.viewBox]="'0 0 ' + vw + ' ' + vh"
      preserveAspectRatio="none" role="img" [attr.aria-label]="ariaLabel">
      @if (area) {
        <defs>
          <linearGradient [attr.id]="gid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="col" stop-opacity="0.3" />
            <stop offset="100%" [attr.stop-color]="col" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path [attr.d]="aPath()" [attr.fill]="'url(#' + gid + ')'" />
      }
      <path [attr.d]="lPath()" fill="none" [attr.stroke]="col" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="draw" vector-effect="non-scaling-stroke" />
    </svg>
  `,
  styles: [
    `
      :host { display: inline-block; line-height: 0; }
      .draw { animation: d 0.8s var(--ease) both; }
      @keyframes d { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
      @media (prefers-reduced-motion: reduce) { .draw { animation: none; } }
    `,
  ],
})
export class SparklineComponent {
  @Input() data: number[] = [];
  @Input() tone: ChartTone = 'accent';
  @Input() width = 96;
  @Input() height = 28;
  @Input() area = true;
  @Input() ariaLabel = 'Trend';

  readonly vw = 100;
  readonly vh = 32;
  readonly gid = `sp-${Math.random().toString(36).slice(2, 8)}`;
  get col(): string { return TONE_VAR[this.tone]; }

  private readonly pts = computed<readonly [number, number][]>(() => {
    const d = this.data;
    if (d.length < 2) return [];
    const min = Math.min(...d);
    const max = Math.max(...d);
    const span = max - min || 1;
    const pad = 3;
    return d.map((v, i) => [
      (this.vw * i) / (d.length - 1),
      pad + (this.vh - pad * 2) * (1 - (v - min) / span),
    ]);
  });

  readonly lPath = computed(() => linePath(this.pts()));
  readonly aPath = computed(() => areaPath(this.pts(), this.vh));
}
