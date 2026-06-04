import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule, RouterLink, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent, MagneticDirective, RoadmapCardComponent],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">My Roadmaps</h1>
        <span class="goal-pill"><span class="dot"></span>{{ activeCount() }} active · {{ pastCount() }} archived</span>
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
      @if (roadmaps().length > 2) {
        <div class="rl-toolbar">
          <div class="rl-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Search roadmaps…" aria-label="Search roadmaps" />
          </div>
          <select [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)" aria-label="Sort roadmaps">
            <option value="recent">Newest first</option>
            <option value="title">Title (A–Z)</option>
            <option value="progress">Most progress</option>
          </select>
        </div>
      }
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
      @if (q().trim() && !active().length && !past().length) {
        <p class="text-sm text-txt-mute py-6 text-center">No roadmaps match “{{ q() }}”.</p>
      }
    }
  `,
  styles: [`
    .rl-toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 18px; }
    .rl-search { position: relative; display: flex; align-items: center; flex: 1; min-width: 200px; }
    .rl-search svg { position: absolute; left: 11px; color: var(--text-mute); pointer-events: none; }
    .rl-search input { width: 100%; padding: 8px 12px 8px 32px; font-size: 13px; color: var(--text); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 11px; }
    .rl-search input:focus { outline: none; border-color: var(--green); }
    .rl-toolbar select { padding: 8px 12px; font-size: 13px; color: var(--text-soft); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 11px; cursor: pointer; }
    .rl-toolbar select:focus { outline: none; border-color: var(--green); }
  `],
})
export class RoadmapListComponent {
  private readonly service = inject(RoadmapService);

  readonly roadmaps = signal<RoadmapSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly q = signal('');
  readonly sortBy = signal<'recent' | 'title' | 'progress'>('recent');

  readonly activeCount = computed(() => this.roadmaps().filter((r) => r.status === 'active').length);
  readonly pastCount = computed(() => this.roadmaps().filter((r) => r.status !== 'active').length);

  private arrange(list: RoadmapSummary[]): RoadmapSummary[] {
    const needle = this.q().trim().toLowerCase();
    const filtered = needle
      ? list.filter((r) => `${r.title} ${r.goal}`.toLowerCase().includes(needle))
      : list;
    const sorted = [...filtered];
    switch (this.sortBy()) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'progress':
        sorted.sort((a, b) => b.progressPercentage - a.progressPercentage);
        break;
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }

  readonly active = computed(() => this.arrange(this.roadmaps().filter((r) => r.status === 'active')));
  readonly past = computed(() => this.arrange(this.roadmaps().filter((r) => r.status !== 'active')));

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
