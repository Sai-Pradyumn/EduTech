import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoadmapSummary } from '../../../core/models';
import { CardComponent } from '../../../shared/ui/card.component';
import { BadgeComponent } from '../../../shared/ui/badge.component';
import { ProgressComponent } from '../../../shared/ui/progress.component';

/** Compact roadmap card for the list view. */
@Component({
  selector: 'asta-roadmap-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, BadgeComponent, ProgressComponent],
  template: `
    <asta-card [accentVar]="active ? 'var(--green)' : null">
      <div class="flex items-start justify-between gap-3 mb-2">
        <h3 class="text-[19px] leading-snug">{{ roadmap.title }}</h3>
        <asta-badge [tone]="statusTone">{{ roadmap.status }}</asta-badge>
      </div>
      <p class="text-sm text-txt-soft mb-1 line-clamp-2">{{ roadmap.goal }}</p>
      <div class="flex flex-wrap gap-2 my-3">
        <span class="pill">{{ roadmap.difficulty }}</span>
        <span class="pill">{{ roadmap.estimatedDuration }}</span>
        <span class="pill">{{ roadmap.totalWeeks }} weeks</span>
      </div>
      <div class="flex items-center gap-3 mb-4">
        <div class="flex-1"><asta-progress [value]="roadmap.progressPercentage" /></div>
        <span class="font-mono text-sm text-txt-soft">{{ roadmap.progressPercentage }}%</span>
      </div>
      <a [routerLink]="['/app/roadmap', roadmap.id]"
        class="inline-flex items-center gap-1.5 text-sm font-semibold rm-link" style="color:var(--green-deep)">
        View roadmap <span class="arr">→</span>
      </a>
    </asta-card>
  `,
  styles: [
    `
      :host { display: block; }
      .arr { display: inline-block; transition: transform 0.2s var(--ease-spring); }
      .rm-link:hover .arr { transform: translateX(4px); }
      @media (prefers-reduced-motion: reduce) { .rm-link:hover .arr { transform: none; } }
    `,
  ],
})
export class RoadmapCardComponent {
  @Input({ required: true }) roadmap!: RoadmapSummary;
  get active(): boolean {
    return this.roadmap.status === 'active';
  }
  get statusTone(): 'success' | 'info' | 'warning' {
    return this.roadmap.status === 'active' ? 'success' : this.roadmap.status === 'completed' ? 'info' : 'warning';
  }
}
