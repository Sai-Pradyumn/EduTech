import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AgentAccent, ACCENT_VAR } from '../../core/constants/agents';

/** Progress bar — flat track, gradient fill with a soft glow, a moving shimmer
 *  and a glowing leading-edge dot. No embossed/3D inset. */
@Component({
  selector: 'asta-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="track" role="progressbar" [attr.aria-valuenow]="clamped">
      <div class="fill" [style.width.%]="clamped" [style.--c]="color">
        <span class="shimmer"></span>
        <span class="lead"></span>
      </div>
    </div>
  `,
  styles: [
    `
      .track {
        position: relative;
        width: 100%;
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        background: color-mix(in oklch, var(--text-mute) 14%, transparent);
      }
      .fill {
        position: relative;
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, color-mix(in oklch, var(--c) 62%, transparent), var(--c));
        box-shadow: 0 0 12px color-mix(in oklch, var(--c) 50%, transparent);
        transition: width 0.9s var(--ease);
      }
      .shimmer {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.45) 50%, transparent 80%);
        transform: translateX(-100%);
        animation: progShimmer 2.4s var(--ease) infinite;
      }
      .lead {
        position: absolute;
        right: 0;
        top: 50%;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        transform: translate(40%, -50%);
        background: #fff;
        box-shadow: 0 0 10px color-mix(in oklch, var(--c) 90%, transparent), 0 0 16px var(--c);
      }
      @keyframes progShimmer {
        0% { transform: translateX(-100%); }
        60%, 100% { transform: translateX(100%); }
      }
    `,
  ],
})
export class ProgressComponent {
  @Input() value = 0;
  @Input() tone: AgentAccent = 'green';
  get clamped(): number {
    return Math.max(0, Math.min(100, Math.round(this.value)));
  }
  get color(): string {
    return ACCENT_VAR[this.tone];
  }
}
