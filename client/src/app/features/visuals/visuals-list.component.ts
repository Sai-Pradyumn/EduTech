import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import {
  VISUAL_TYPE_LIST,
  VISUAL_TYPE_META,
  Visual,
  VisualService,
  VisualType,
} from '../../core/services/visual.service';

@Component({
  selector: 'asta-visuals-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Visual Studio</h1>
        <span class="goal-pill"><span class="dot"></span>See it to learn it · turn any concept into a diagram</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn>
      </div>
    </header>

    <asta-card class="block motion-card-reveal motion-row-primary mb-5">
      <p class="kicker mb-3">Generate a visual</p>
      <div class="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Concept</span>
          <input class="v-input mt-1" [(ngModel)]="concept" (keydown.enter)="generate()" placeholder="e.g. How a React render works" maxlength="200" aria-label="Concept" />
        </label>
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Type</span>
          <select class="v-input mt-1" [(ngModel)]="type" aria-label="Visual type">
            <option value="">Auto (let Asta choose)</option>
            @for (t of typeList; track t) { <option [value]="t">{{ meta(t).label }}</option> }
          </select>
        </label>
        <asta-btn variant="accent" [loading]="generating()" [disabled]="!canGenerate()" (click)="generate()">
          Generate <span class="arr">→</span>
        </asta-btn>
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        @for (idea of ideas; track idea) {
          <button class="idea-chip" type="button" (click)="concept = idea">{{ idea }}</button>
        }
      </div>
    </asta-card>

    @if (loading()) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 motion-row-2">
        @for (i of [1, 2, 3, 4, 5, 6]; track i) { <asta-card><asta-skeleton h="120px" /><div class="mt-3"><asta-skeleton h="18px" w="60%" /></div></asta-card> }
      </div>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load visuals" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (visuals().length === 0) {
      <asta-card class="block motion-card-reveal motion-row-2">
        <asta-empty-state title="No visuals yet" description="Type a concept above and Asta will draw it — a mind map, flowchart, architecture diagram, comparison and more. No image API needed.">
          <asta-btn variant="accent" (click)="focusConcept()">Generate your first visual</asta-btn>
        </asta-empty-state>
      </asta-card>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 motion-row-2">
        @for (v of visuals(); track v.id; let i = $index) {
          <asta-card class="motion-card-reveal hover-lift cursor-pointer block" [interactive]="true" [style.--motion-card-index]="i % 3" (click)="open(v)">
            <div class="thumb">
              @if (v.thumbnail) { <img [src]="v.thumbnail" [alt]="v.title" /> } @else { <span class="thumb-glyph">{{ meta(v.type).glyph }}</span> }
            </div>
            <div class="flex items-start justify-between gap-2 mt-3">
              <p class="font-medium leading-snug line-clamp-2">{{ v.title }}</p>
              <span class="fmt-badge">{{ v.contentFormat }}</span>
            </div>
            <p class="text-xs text-txt-mute mt-1">{{ meta(v.type).glyph }} {{ meta(v.type).label }}</p>
          </asta-card>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .v-input { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 12px; color: var(--text); font-size: 14px; }
      .v-input:focus { outline: none; border-color: var(--green); }
      .idea-chip { font-size: 12px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--paper-3); color: var(--text-soft); background: transparent; cursor: pointer; transition: border-color .2s, color .2s, transform .2s; }
      .idea-chip:hover { border-color: var(--green); color: var(--text); transform: translateY(-1px); }
      .thumb { height: 120px; border-radius: 12px; overflow: hidden; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); display: grid; place-items: center; }
      .thumb img { width: 100%; height: 100%; object-fit: cover; }
      .thumb-glyph { font-size: 40px; color: var(--green); }
      .fmt-badge { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--paper-3); color: var(--text-mute); white-space: nowrap; }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    `,
  ],
})
export class VisualsListComponent {
  private readonly api = inject(VisualService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly visuals = signal<Visual[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly generating = signal(false);

  concept = '';
  type: VisualType | '' = '';
  readonly typeList = VISUAL_TYPE_LIST;
  readonly ideas = ['How a React render works', 'TCP vs UDP', 'Scalable web app architecture', 'Big-O complexity', 'JWT auth flow'];

  readonly canGenerate = computed(() => this.concept.trim().length >= 2 && !this.generating());

  constructor() {
    this.refresh();
  }

  meta(t: VisualType) {
    return VISUAL_TYPE_META[t];
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.list().subscribe({
      next: (l) => { this.visuals.set(l); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  focusConcept(): void {
    document.querySelector<HTMLInputElement>('.v-input')?.focus();
  }

  generate(): void {
    if (!this.canGenerate()) return;
    this.generating.set(true);
    this.api.generate({ concept: this.concept.trim(), type: this.type || undefined }).subscribe({
      next: (v) => {
        this.generating.set(false);
        this.toast.success('Visual generated');
        this.visuals.update((l) => [v, ...l]);
        this.router.navigate(['/app/visuals', v.id]);
      },
      error: (e: Error) => { this.generating.set(false); this.toast.error(e.message || 'Could not generate visual'); },
    });
  }

  open(v: Visual): void {
    this.router.navigate(['/app/visuals', v.id]);
  }
}
