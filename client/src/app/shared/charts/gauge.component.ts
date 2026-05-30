import { AfterViewInit, ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ChartTone, TONE_VAR, TONE_DEEP_VAR, clamp } from './chart-utils';

/**
 * `asta-gauge` — single-metric 270° arc (health, readiness, usage). Token-driven,
 * draw-in via dasharray transition (reduced-motion-safe), centre value + label,
 * a11y (`role="img"` + `aria-label`). Value is clamped to [0, max].
 */
@Component({
  selector: 'asta-gauge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="g" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" [attr.width]="size" [attr.height]="size"
        role="img" [attr.aria-label]="ariaLabel || (label + ': ' + display())">
        <circle [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none" stroke="var(--paper-3)" [attr.stroke-width]="thickness"
          stroke-linecap="round" [attr.stroke-dasharray]="arc + ' ' + circ"
          [attr.transform]="'rotate(135 ' + c + ' ' + c + ')'" />
        <circle [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none" [attr.stroke]="color" [attr.stroke-width]="thickness"
          stroke-linecap="round" [attr.stroke-dasharray]="(drawn() ? valLen() : 0) + ' ' + circ"
          [attr.transform]="'rotate(135 ' + c + ' ' + c + ')'" class="val" />
      </svg>
      <div class="center">
        <span class="cv" [style.color]="colorDeep">{{ display() }}</span>
        @if (label) { <span class="cl">{{ label }}</span> }
      </div>
    </div>
  `,
  styles: [
    `
      .g { position: relative; }
      .val { transition: stroke-dasharray 0.9s var(--ease-spring); }
      @media (prefers-reduced-motion: reduce) { .val { transition: none; } }
      .center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; }
      .cv { font-family: var(--display); font-weight: 600; font-size: clamp(18px, 22%, 30px); line-height: 1; }
      .cl { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-mute); margin-top: 4px; }
    `,
  ],
})
export class GaugeComponent implements AfterViewInit {
  @Input() value = 0;
  @Input() max = 100;
  @Input() size = 130;
  @Input() thickness = 12;
  @Input() tone: ChartTone = 'green';
  @Input() label = '';
  @Input() ariaLabel = '';
  /** Show as percentage of max (default) or raw value with optional suffix. */
  @Input() unit: '%' | 'raw' = '%';
  @Input() format?: (v: number) => string;

  readonly drawn = signal(false);

  get c(): number { return this.size / 2; }
  get r(): number { return this.size / 2 - this.thickness / 2 - 2; }
  get circ(): number { return 2 * Math.PI * this.r; }
  /** Track arc length = 270° of the circle. */
  get arc(): number { return this.circ * 0.75; }
  get color(): string { return TONE_VAR[this.tone]; }
  get colorDeep(): string { return TONE_DEEP_VAR[this.tone]; }

  private readonly frac = computed(() => clamp(this.value / (this.max || 1), 0, 1));
  readonly valLen = computed(() => this.frac() * this.arc);
  readonly display = computed(() => {
    if (this.format) return this.format(this.value);
    if (this.unit === '%') return `${Math.round(this.frac() * 100)}%`;
    return String(Math.round(this.value));
  });

  ngAfterViewInit(): void {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.drawn.set(true);
      return;
    }
    requestAnimationFrame(() => this.drawn.set(true));
  }
}
