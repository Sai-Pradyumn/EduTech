import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  ChartDatum,
  ChartTone,
  TONE_VAR,
  TONE_DEEP_VAR,
  areaPath,
  formatCompact,
  linePath,
  niceMax,
  ticks,
} from './chart-utils';

/**
 * `asta-line-chart` — trend line / area chart (Workstream C1). Token-driven,
 * responsive (ResizeObserver → exact height, no distortion), reduced-motion-safe
 * draw-in (`pathLength` dashoffset), hover tooltip with guide + dot, empty state,
 * `role="img"` + aria-label. Set `[area]="true"` for a gradient area fill.
 */
@Component({
  selector: 'asta-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.length < 2) {
      <div class="empty" [style.height.px]="height">No trend data yet</div>
    } @else {
      <div class="wrap" [style.height.px]="height" (pointerleave)="hover.set(-1)">
        <svg
          [attr.viewBox]="'0 0 ' + w() + ' ' + height" width="100%" [attr.height]="height"
          role="img" [attr.aria-label]="ariaLabel || label"
          (pointermove)="onMove($event)"
        >
          <!-- gridlines + y ticks -->
          @for (t of yTicks(); track t.y) {
            <line [attr.x1]="padL" [attr.x2]="w() - padR" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--paper-3)" stroke-width="1" />
            <text [attr.x]="padL - 6" [attr.y]="t.y + 3" text-anchor="end" class="ax">{{ t.text }}</text>
          }
          <!-- area fill -->
          @if (area) {
            <defs>
              <linearGradient [attr.id]="gid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" [attr.stop-color]="stroke" stop-opacity="0.28" />
                <stop offset="100%" [attr.stop-color]="stroke" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path [attr.d]="aPath()" [attr.fill]="'url(#' + gid + ')'" class="area" />
          }
          <!-- line -->
          <path [attr.d]="lPath()" fill="none" [attr.stroke]="stroke" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="draw" />
          <!-- x labels (first / mid / last) -->
          @for (x of xLabels(); track x.i) {
            <text [attr.x]="x.px" [attr.y]="height - 6" [attr.text-anchor]="x.anchor" class="ax">{{ x.text }}</text>
          }
          <!-- hover guide + dot -->
          @if (hover() > -1) {
            <line [attr.x1]="pt(hover()).x" [attr.x2]="pt(hover()).x" [attr.y1]="padT" [attr.y2]="height - padB"
              stroke="var(--text-mute)" stroke-width="1" stroke-dasharray="3 3" opacity="0.5" />
            <circle [attr.cx]="pt(hover()).x" [attr.cy]="pt(hover()).y" r="4.5" [attr.fill]="strokeDeep" stroke="var(--paper)" stroke-width="2" />
          }
        </svg>
        @if (hover() > -1) {
          <div class="tip" [style.left.px]="pt(hover()).x" [style.top.px]="pt(hover()).y">
            <span class="tl">{{ data[hover()].label }}</span>
            <span class="tv">{{ fmt(data[hover()].value) }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .wrap { position: relative; width: 100%; }
      .empty { display: grid; place-items: center; color: var(--text-mute); font-family: var(--mono); font-size: 12px; }
      .ax { fill: var(--text-mute); font-family: var(--mono); font-size: 10px; }
      .draw { animation: draw 0.9s var(--ease) both; }
      .area { animation: fade 0.9s var(--ease) both; }
      @keyframes draw { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
      @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .draw, .area { animation: none; } }
      .tip {
        position: absolute; transform: translate(-50%, calc(-100% - 10px)); pointer-events: none;
        background: var(--ink); color: var(--on-ink); padding: 5px 9px; border-radius: 8px;
        box-shadow: var(--shadow-md); white-space: nowrap; display: flex; flex-direction: column; gap: 1px; z-index: 2;
      }
      .tl { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--on-ink-mute); }
      .tv { font-family: var(--display); font-weight: 600; font-size: 13px; }
    `,
  ],
})
export class LineChartComponent implements AfterViewInit, OnDestroy {
  @Input() data: ChartDatum[] = [];
  @Input() tone: ChartTone = 'accent';
  @Input() height = 180;
  @Input() area = false;
  @Input() label = 'Trend';
  @Input() ariaLabel = '';
  /** Currency / unit prefix-suffix formatter override. */
  @Input() format?: (v: number) => string;

  private readonly host = inject(ElementRef<HTMLElement>);
  private ro?: ResizeObserver;
  readonly w = signal(600);
  readonly hover = signal(-1);
  readonly gid = `lg-${Math.random().toString(36).slice(2, 8)}`;

  readonly padL = 34;
  readonly padR = 10;
  readonly padT = 12;
  readonly padB = 20;

  get stroke(): string { return TONE_VAR[this.tone]; }
  get strokeDeep(): string { return TONE_DEEP_VAR[this.tone]; }

  private readonly maxV = computed(() => niceMax(Math.max(1, ...this.data.map((d) => d.value))));

  private readonly pts = computed<readonly [number, number][]>(() => {
    const n = this.data.length;
    if (n < 2) return [];
    const innerW = this.w() - this.padL - this.padR;
    const innerH = this.height - this.padT - this.padB;
    const max = this.maxV();
    return this.data.map((d, i) => [
      this.padL + (innerW * i) / (n - 1),
      this.padT + innerH * (1 - d.value / max),
    ]);
  });

  readonly lPath = computed(() => linePath(this.pts()));
  readonly aPath = computed(() => areaPath(this.pts(), this.height - this.padB));

  readonly yTicks = computed(() =>
    ticks(this.maxV(), 4).map((v) => ({
      y: this.padT + (this.height - this.padT - this.padB) * (1 - v / this.maxV()),
      text: this.fmt(v),
    })),
  );

  readonly xLabels = computed(() => {
    const n = this.data.length;
    if (n < 2) return [];
    const mk = (i: number, anchor: string) => ({ i, px: this.pts()[i][0], anchor, text: this.data[i].label });
    const mid = Math.floor((n - 1) / 2);
    return [mk(0, 'start'), mk(mid, 'middle'), mk(n - 1, 'end')];
  });

  pt(i: number): { x: number; y: number } {
    const p = this.pts()[i];
    return { x: p[0], y: p[1] };
  }

  fmt(v: number): string {
    return this.format ? this.format(v) : formatCompact(v);
  }

  onMove(e: PointerEvent): void {
    const n = this.data.length;
    if (n < 2) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const innerW = this.w() - this.padL - this.padR;
    const frac = (((e.clientX - rect.left) / rect.width) * this.w() - this.padL) / innerW;
    this.hover.set(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  }

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.ro = new ResizeObserver(() => this.w.set(Math.max(120, el.clientWidth)));
    this.ro.observe(el);
    this.w.set(Math.max(120, el.clientWidth));
  }
  ngOnDestroy(): void {
    this.ro?.disconnect();
  }
}
