import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AgentAccent, ACCENT_VAR } from '../../core/constants/agents';
import { CountDirective } from '../directives/count.directive';

let ringSeq = 0;

/** Progress ring — gradient arc with a draw-in animation, soft glow, and a
 *  counting-up centre number. Flat centre (no embossed 3D inset). */
@Component({
  selector: 'asta-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountDirective],
  template: `
    <span class="relative inline-grid place-items-center" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size">
        <defs>
          <linearGradient [attr.id]="gid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" [style.stopColor]="color" />
            <stop offset="1" style="stop-color: var(--asta-cyan)" />
          </linearGradient>
        </defs>
        <circle class="track" [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none" [attr.stroke-width]="stroke" />
        <circle
          class="prog"
          [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="none"
          [attr.stroke]="'url(#' + gid + ')'" [attr.stroke-width]="stroke" stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="offset"
          [attr.transform]="'rotate(-90 ' + c + ' ' + c + ')'"
        />
      </svg>
      <span class="num font-display font-semibold" [style.fontSize.px]="size * 0.27" [astaCount]="clamped" suffix="%"></span>
    </span>
  `,
  styles: [
    `
      .track { stroke: color-mix(in oklch, var(--text-mute) 16%, transparent); }
      .prog {
        filter: drop-shadow(0 0 4px var(--asta-accent-glow));
        transition: stroke-dashoffset 0.9s var(--ease);
      }
      .num { position: absolute; color: var(--text); letter-spacing: -0.02em; }
    `,
  ],
})
export class RingComponent {
  @Input() value = 0;
  @Input() size = 96;
  @Input() stroke = 8;
  @Input() tone: AgentAccent = 'green';

  readonly gid = `astaRing${++ringSeq}`;

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
