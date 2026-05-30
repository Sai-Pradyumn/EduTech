import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoadmapService } from '../../core/services/roadmap.service';
import { RoadmapSummary } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { RoadmapCardComponent } from './components/roadmap-card.component';

@Component({
  selector: 'asta-roadmap-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent, MagneticDirective, RoadmapCardComponent],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">My Roadmaps</h1>
        <span class="goal-pill"><span class="dot"></span>{{ active().length }} active · {{ past().length }} archived</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="accent" astaMagnetic routerLink="/app/roadmap/generate">Generate new</asta-btn>
      </div>
    </header>

    @if (loading()) {
      <div class="grid gap-5 md:grid-cols-2">
        @for (i of [1, 2]; track i) { <asta-card><asta-skeleton h="22px" w="60%" /><div class="mt-4"><asta-skeleton h="90px" /></div></asta-card> }
      </div>
    } @else if (error()) {
      <asta-card>
        <div class="text-center py-8">
          <p class="text-txt-soft mb-4">Couldn’t load your roadmaps.</p>
          <asta-btn variant="ghost" size="sm" (click)="load()">Retry</asta-btn>
        </div>
      </asta-card>
    } @else if (roadmaps().length === 0) {
      <asta-card class="block motion-card-reveal motion-row-primary">
        <asta-empty-state title="No roadmap yet" description="Asta can build a focused, week-by-week path from your goal — sequenced modules, weekly tasks, projects and checkpoints.">
          <asta-btn variant="accent" astaMagnetic routerLink="/app/roadmap/generate">Build my roadmap</asta-btn>
        </asta-empty-state>
      </asta-card>
    } @else {
      @if (active().length) {
        <p class="kicker mb-3">Active</p>
        <div class="grid gap-5 md:grid-cols-2 mb-8 motion-row-primary">
          @for (r of active(); track r.id; let i = $index) { <asta-roadmap-card class="block motion-card-reveal" [style.--motion-card-index]="i" [roadmap]="r" /> }
        </div>
      }
      @if (past().length) {
        <p class="kicker mb-3">Past &amp; archived</p>
        <div class="grid gap-5 md:grid-cols-2 motion-row-2">
          @for (r of past(); track r.id; let i = $index) { <asta-roadmap-card class="block motion-card-reveal" [style.--motion-card-index]="i" [roadmap]="r" /> }
        </div>
      }
    }
  `,
})
export class RoadmapListComponent {
  private readonly service = inject(RoadmapService);

  readonly roadmaps = signal<RoadmapSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly active = computed(() => this.roadmaps().filter((r) => r.status === 'active'));
  readonly past = computed(() => this.roadmaps().filter((r) => r.status !== 'active'));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.getMine().subscribe({
      next: (list) => {
        this.roadmaps.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
