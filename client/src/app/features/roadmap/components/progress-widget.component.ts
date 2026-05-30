import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Roadmap } from '../../../core/models';
import { CardComponent } from '../../../shared/ui/card.component';
import { RingComponent } from '../../../shared/ui/ring.component';

/** Progress summary: ring + week/milestone counts for the detail header. */
@Component({
  selector: 'asta-progress-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, RingComponent],
  template: `
    <asta-card>
      <div class="flex items-center gap-5">
        <asta-ring [value]="roadmap.progressPercentage" [size]="92" />
        <div class="space-y-1">
          <p class="text-sm text-txt-soft">
            <span class="font-semibold text-txt">{{ roadmap.completedWeeks.length }}</span> / {{ roadmap.weeklyPlan.length }} weeks done
          </p>
          <p class="text-sm text-txt-soft">
            <span class="font-semibold text-txt">{{ milestonesReached }}</span> / {{ roadmap.milestones.length }} milestones
          </p>
          <p class="text-sm text-txt-soft">{{ roadmap.estimatedDuration }}</p>
        </div>
      </div>
    </asta-card>
  `,
})
export class ProgressWidgetComponent {
  @Input({ required: true }) roadmap!: Roadmap;
  get milestonesReached(): number {
    const done = this.roadmap.completedWeeks.length;
    return this.roadmap.milestones.filter((m) => m.targetWeek <= done).length;
  }
}
