import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AgentAccent, ACCENT_VAR } from '../../core/constants/agents';

/** Progress ring — SVG circle with animated dashoffset (DESIGN_SPEC §4.1). */
@Component({
  selector: 'asta-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="relative inline-grid place-items-center" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size">
        <circle [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none" stroke="var(--paper-3)" [attr.stroke-width]="stroke" />
        <circle
          [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none" [attr.stroke]="color" [attr.stroke-width]="stroke"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="offset"
          [attr.transform]="'rotate(-90 ' + c + ' ' + c + ')'"
          style="transition: stroke-dashoffset .8s var(--ease)"
        />
      </svg>
      <span class="absolute font-display font-semibold" [style.fontSize.px]="size * 0.26">{{ clamped }}%</span>
    </span>
  `,
})
export class RingComponent {
  @Input() value = 0;
  @Input() size = 96;
  @Input() stroke = 8;
  @Input() tone: AgentAccent = 'green';

  get clamped(): number {
    return Math.max(0, Math.min(100, Math.round(this.value)));
  }
  get c(): number {
    return this.size / 2;
  }
  get r(): number {
    return this.size / 2 - this.stroke;
  }
  get circumference(): number {
    return 2 * Math.PI * this.r;
  }
  get offset(): number {
    return this.circumference * (1 - this.clamped / 100);
  }
  get color(): string {
    return ACCENT_VAR[this.tone];
  }
}
