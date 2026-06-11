import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AgentAccent, ACCENT_DEEP_VAR, ACCENT_VAR } from '../../../core/constants/agents';
import { CardComponent } from '../../ui/card.component';

/** Compact AI insight card: kicker + headline + body, accent-tinted. */
@Component({
  selector: 'asta-ai-insight-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    <asta-card [accentVar]="accentVar">
      <p class="kicker mb-2" [style.color]="deep">{{ kicker }}</p>
      @if (headline) { <p class="text-[18px] font-display font-semibold mb-1">{{ headline }}</p> }
      <p class="text-sm text-txt-soft"><ng-content /></p>
    </asta-card>
  `,
})
export class AiInsightCardComponent {
  @Input() kicker = 'Insight';
  @Input() headline = '';
  @Input() accent: AgentAccent = 'green';
  get accentVar(): string {
    return ACCENT_VAR[this.accent];
  }
  get deep(): string {
    return ACCENT_DEEP_VAR[this.accent];
  }
}
