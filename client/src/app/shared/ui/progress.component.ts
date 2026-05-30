import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AgentAccent, ACCENT_VAR } from '../../core/constants/agents';

@Component({
  selector: 'asta-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="w-full rounded-full overflow-hidden"
      style="height:6px;background:var(--paper-3)"
      role="progressbar"
      [attr.aria-valuenow]="clamped"
    >
      <div
        class="h-full rounded-full transition-[width] duration-700"
        [style.width.%]="clamped"
        [style.background]="color"
      ></div>
    </div>
  `,
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
