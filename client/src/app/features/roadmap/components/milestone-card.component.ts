import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RoadmapMilestone } from '../../../core/models';
import { CardComponent } from '../../../shared/ui/card.component';

@Component({
  selector: 'asta-milestone-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    <asta-card [accentVar]="reached ? 'var(--green)' : 'var(--paper-3)'">
      <div class="flex items-center justify-between mb-1.5">
        <p class="font-mono text-[11px] uppercase tracking-wider text-txt-mute">Week {{ milestone.targetWeek }}</p>
        @if (reached) {
          <span class="text-xs font-semibold" style="color:var(--green-deep)">Reached</span>
        }
      </div>
      <h4 class="text-[17px] mb-1.5">{{ milestone.title }}</h4>
      <p class="text-sm text-txt-soft mb-3">{{ milestone.description }}</p>
      <ul class="text-sm text-txt-soft space-y-1">
        @for (c of milestone.completionCriteria; track c) {
          <li class="flex gap-2"><span style="color:var(--green-deep)">•</span> {{ c }}</li>
        }
      </ul>
    </asta-card>
  `,
})
export class MilestoneCardComponent {
  @Input({ required: true }) milestone!: RoadmapMilestone;
  @Input() reached = false;
}
