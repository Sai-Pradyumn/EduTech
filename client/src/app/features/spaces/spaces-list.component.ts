import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { SpaceService, StudySpace } from '../../core/services/space.service';

@Component({
  selector: 'asta-spaces-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Study Spaces</h1>
        <span class="goal-pill"><span class="dot"></span>Multimodal notebooks · ask your sources, generate everything</span>
      </div>
      <div class="flex gap-2.5 shrink-0"><asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn></div>
    </header>

    <asta-card class="block motion-card-reveal motion-row-primary mb-5">
      <p class="kicker mb-3">New space</p>
      <div class="flex gap-3 md:items-end">
        <label class="block flex-1">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Title</span>
          <input class="sp-input mt-1" [(ngModel)]="title" (keydown.enter)="create()" placeholder="e.g. System Design Basics" maxlength="160" aria-label="Space title" />
        </label>
        <asta-btn variant="accent" [loading]="creating()" [disabled]="title.trim().length < 2" (click)="create()">Create <span class="arr">→</span></asta-btn>
      </div>
    </asta-card>

    @if (loading()) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">@for (i of [1,2,3]; track i) { <asta-card><asta-skeleton h="90px" /></asta-card> }</div>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load spaces" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (spaces().length === 0) {
      <asta-card class="block motion-card-reveal"><asta-empty-state title="No study spaces yet" description="Create a space, drop in notes/transcripts/links, then ask grounded questions and generate flashcards, a quiz, a flow or a concept map."><asta-btn variant="accent" (click)="focusTitle()">Create your first space</asta-btn></asta-empty-state></asta-card>
    } @else {
      <div class="toolbar motion-row-2 mb-4">
        <input class="sp-input" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search spaces…" aria-label="Search spaces" />
        <select class="sp-input sp-sel" [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort spaces">
          <option value="newest">Newest</option>
          <option value="title">Title A–Z</option>
          <option value="sources">Most sources</option>
        </select>
        <span class="tb-count">{{ filteredSpaces().length }} of {{ spaces().length }}</span>
      </div>

      @if (filteredSpaces().length === 0) {
        <asta-card class="block"><asta-empty-state title="No matches" description="No spaces match your search."><asta-btn variant="ghost" (click)="query.set('')">Clear search</asta-btn></asta-empty-state></asta-card>
      } @else {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 motion-row-2">
        @for (s of filteredSpaces(); track s.id; let i = $index) {
          <asta-card class="motion-card-reveal hover-lift cursor-pointer block" [interactive]="true" [style.--motion-card-index]="i % 3" (click)="open(s)">
            <p class="font-display text-lg leading-snug truncate">{{ s.title }}</p>
            <p class="text-sm text-txt-mute mt-0.5 line-clamp-2">{{ s.description || 'No description' }}</p>
            <div class="flex flex-wrap gap-1.5 mt-3 text-[11px] text-txt-mute">
              <span class="pill">{{ s.sources.length }} sources</span>
              @if (s.artifacts.length) { <span class="pill chip-ok">✦ {{ s.artifacts.length }} generated</span> }
              @if (s.linkedFlowIds.length) { <span class="pill">→ {{ s.linkedFlowIds.length }} flow</span> }
              @if (s.linkedQuizIds.length) { <span class="pill">→ {{ s.linkedQuizIds.length }} quiz</span> }
              @if (s.linkedVisualIds.length) { <span class="pill">→ {{ s.linkedVisualIds.length }} visual</span> }
            </div>
          </asta-card>
        }
      </div>
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .sp-input { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 12px; color: var(--text); font-size: 14px; }
      .sp-input:focus { outline: none; border-color: var(--green); }
      .pill { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--paper-3); background: color-mix(in oklab, var(--paper-2) 70%, transparent); }
      .chip-ok { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .toolbar .sp-input:first-child { flex: 1 1 220px; }
      .sp-sel { flex: 0 0 auto; width: auto; }
      .tb-count { font-size: 12px; color: var(--text-mute); margin-left: auto; white-space: nowrap; }
    `,
  ],
})
export class SpacesListComponent {
  private readonly api = inject(SpaceService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly spaces = signal<StudySpace[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly creating = signal(false);
  title = '';

  readonly query = signal('');
  readonly sort = signal<'newest' | 'title' | 'sources'>('newest');
  readonly filteredSpaces = computed(() => {
    const q = this.query().trim().toLowerCase();
    const s = this.sort();
    let out = this.spaces();
    if (q) out = out.filter((sp) => sp.title.toLowerCase().includes(q) || sp.description.toLowerCase().includes(q));
    return [...out].sort((a, b) => {
      if (s === 'title') return a.title.localeCompare(b.title);
      if (s === 'sources') return b.sources.length - a.sources.length;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  });

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.list().subscribe({ next: (l) => { this.spaces.set(l); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  focusTitle(): void { document.querySelector<HTMLInputElement>('.sp-input')?.focus(); }
  create(): void {
    if (this.title.trim().length < 2) return;
    this.creating.set(true);
    this.api.create({ title: this.title.trim() }).subscribe({
      next: (s) => { this.creating.set(false); this.router.navigate(['/app/spaces', s.id]); },
      error: (e: Error) => { this.creating.set(false); this.toast.error(e.message || 'Could not create space'); },
    });
  }
  open(s: StudySpace): void { this.router.navigate(['/app/spaces', s.id]); }
}
