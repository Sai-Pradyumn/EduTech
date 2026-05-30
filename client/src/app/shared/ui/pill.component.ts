import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AgentAccent, ACCENT_VAR } from '../../core/constants/agents';

@Component({
  selector: 'asta-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="pill">
      @if (dot) {
        <span class="dot" [style.background]="dotColor"></span>
      }
      <ng-content />
    </span>
  `,
})
export class PillComponent {
  @Input() dot = false;
  @Input() accent: AgentAccent = 'green';
  get dotColor(): string {
    return ACCENT_VAR[this.accent];
  }
}
