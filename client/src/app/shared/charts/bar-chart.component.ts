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
import { ChartDatum, ChartTone, TONE_VAR, formatCompact, niceMax } from './chart-utils';

/**
 * `asta-bar-chart` — vertical (default) or horizontal bars (Workstream C1).
 * Per-bar tone override, grow-in animation (reduced-motion-safe), hover tooltip,
 * value labels, empty state, a11y. Responsive via ResizeObserver.
 */
@Component({
  selector: 'asta-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!data.length) {
      <div class="empty" [style.height.px]="height">No data yet</div>
    } @else if (horizontal) {
      <div class="hb" role="img" [attr.aria-label]="ariaLabel || label">
        @for (d of data; track d.label; let i = $index) {
          <div class="row" (pointerenter)="hover.set(i)" (pointerleave)="hover.set(-1)">
            <span class="rl" [title]="d.label">{{ d.label }}</span>
            <div class="track">
              <div class="fill grow" [style.width.%]="pct(d.value)" [style.background]="col(d)" [style.animation-delay.ms]="i * 50"></div>
            </div>
            <span class="rv">{{ fmt(d.value) }}</span>
          </div>
        }
      </div>
    } @else {
      <div class="wrap" [style.height.px]="height" (pointerleave)="hover.set(-1)">
        <svg [attr.viewBox]="'0 0 ' + w() + ' ' + height" width="100%" [attr.height]="height"
          role="img" [attr.aria-label]="ariaLabel || label">
          @for (b of bars(); track b.i) {
            <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="4"
              [attr.fill]="b.col" class="vbar" [style.transform-origin]="'center ' + (height - padB) + 'px'"
              [style.animation-delay.ms]="b.i * 50"
              (pointerenter)="hover.set(b.i)" />
            <text [attr.x]="b.cx" [attr.y]="height - 5" text-anchor="middle" class="ax">{{ b.short }}</text>
          }
          @if (hover() > -1) {
            <text [attr.x]="bars()[hover()].cx" [attr.y]="bars()[hover()].y - 5" text-anchor="middle" class="val">{{ fmt(data[hover()].value) }}</text>
          }
        </svg>
      </div>
    }
  `,
  styles: [
    `
      .wrap { position: relative; width: 100%; }
      .empty { display: grid; place-items: center; color: var(--text-mute); font-family: var(--mono); font-size: 12px; }
      .ax { fill: var(--text-mute); font-family: var(--mono); font-size: 10px; }
      .val { fill: var(--text); font-family: var(--display); font-weight: 600; font-size: 12px; }
      .vbar { animation: grow .6s var(--ease-spring) both; transition: filter .15s; }
      .vbar:hover { filter: brightness(1.08); }
      @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      /* horizontal */
      .hb { display: flex; flex-direction: column; gap: 10px; }
      .row { display: grid; grid-template-columns: minmax(60px, 28%) 1fr auto; align-items: center; gap: 10px; }
      .rl { font-size: 13px; color: var(--text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rv { font-family: var(--mono); font-size: 12px; color: var(--text); }
      .track { height: 9px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .fill { height: 100%; border-radius: 100px; }
      .grow { animation: gw .6s var(--ease) both; }
      @keyframes gw { from { width: 0 !important; } }
      @media (prefers-reduced-motion: reduce) { .vbar, .grow { animation: none; } }
    `,
  ],
})
export class BarChartComponent implements AfterViewInit, OnDestroy {
  @Input() data: ChartDatum[] = [];
  @Input() tone: ChartTone = 'accent';
  @Input() height = 180;
  @Input() horizontal = false;
  @Input() label = 'Bar chart';
  @Input() ariaLabel = '';
  @Input() format?: (v: number) => string;

  private readonly host = inject(ElementRef<HTMLElement>);
  private ro?: ResizeObserver;
  readonly w = signal(400);
  readonly hover = signal(-1);
  readonly padB = 18;
  readonly padT = 14;

  private readonly maxV = computed(() => niceMax(Math.max(1, ...this.data.map((d) => d.value))));

  readonly bars = computed(() => {
    const n = this.data.length;
    if (!n) return [];
    const innerW = this.w() - 8;
    const innerH = this.height - this.padB - this.padT;
    const slot = innerW / n;
    const bw = Math.min(48, slot * 0.62);
    const max = this.maxV();
    return this.data.map((d, i) => {
      const h = Math.max(2, innerH * (d.value / max));
      const cx = 4 + slot * i + slot / 2;
      return {
        i,
        x: cx - bw / 2,
        y: this.padT + (innerH - h),
        w: bw,
        h,
        cx,
        col: TONE_VAR[d.tone ?? this.tone],
        short: d.label.length > 6 ? d.label.slice(0, 6) : d.label,
      };
    });
  });

  pct(v: number): number {
    return (v / this.maxV()) * 100;
  }
  col(d: ChartDatum): string {
    return TONE_VAR[d.tone ?? this.tone];
  }
  fmt(v: number): string {
    return this.format ? this.format(v) : formatCompact(v);
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
