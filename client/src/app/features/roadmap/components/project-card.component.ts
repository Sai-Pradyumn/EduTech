import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RoadmapProject } from '../../../core/models';
import { CardComponent } from '../../../shared/ui/card.component';

@Component({
  selector: 'asta-project-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    <asta-card accentVar="var(--coral)">
      <div class="flex items-center justify-between mb-1.5">
        <h4 class="text-[17px]">{{ project.title }}</h4>
        <span class="pill" style="color:var(--coral-deep);border-color:var(--coral)">{{ project.difficulty }}</span>
      </div>
      <p class="text-sm text-txt-soft mb-3">{{ project.description }}</p>
      <div class="flex flex-wrap gap-1.5">
        @for (s of project.skillsCovered; track s) { <span class="pill">{{ s }}</span> }
      </div>
    </asta-card>
  `,
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: RoadmapProject;
}
