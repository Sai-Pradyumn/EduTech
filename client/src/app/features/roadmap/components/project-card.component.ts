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
      <div class="ms-skills flex flex-wrap gap-1.5">
        @for (s of project.skillsCovered; track s) { <span class="pill">{{ s }}</span> }
      </div>
    </asta-card>
  `,
  styles: [
    `
      :host { display: block; }
      /* Skills the project covers pop in as a set. */
      .ms-skills .pill { animation: astaSoftPop 0.35s var(--ease-spring) both; }
      .ms-skills .pill:nth-child(2) { animation-delay: 0.04s; }
      .ms-skills .pill:nth-child(3) { animation-delay: 0.08s; }
      .ms-skills .pill:nth-child(4) { animation-delay: 0.12s; }
      .ms-skills .pill:nth-child(5) { animation-delay: 0.16s; }
      .ms-skills .pill:nth-child(6) { animation-delay: 0.2s; }
      @media (prefers-reduced-motion: reduce) { .ms-skills .pill { animation: none; } }
    `,
  ],
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: RoadmapProject;
}
