import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CardComponent } from '../ui/card.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { BadgeComponent } from '../ui/badge.component';

/** Temporary page for features arriving in a later phase. Keeps nav coherent. */
@Component({
  selector: 'asta-placeholder-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, EmptyStateComponent, BadgeComponent],
  template: `
    <asta-card>
      <asta-empty-state [title]="heading" [description]="description">
        <asta-badge tone="info">Phase {{ phase }}</asta-badge>
      </asta-empty-state>
    </asta-card>
  `,
})
export class PlaceholderPageComponent {
  @Input() heading = 'Coming soon';
  @Input() description = 'This area is being built.';
  @Input() phase = 2;
}
