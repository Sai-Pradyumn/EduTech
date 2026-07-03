import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { MarketplaceService, Template } from '../../core/services/marketplace.service';

const TYPES = ['', 'flow', 'roadmap', 'quiz', 'project', 'simulation', 'interview', 'course', 'study_space', 'visual'];

@Component({
    selector: 'asta-marketplace',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Marketplace</h1>
        <span class="goal-pill"><span class="dot"></span>Reusable learning assets from mentors &amp; creators</span>
      </div>
      <div class="shrink-0"><asta-btn variant="ghost" size="sm" (click)="go('/app/creator-studio')">Creator Studio →</asta-btn></div>
    </header>

    <div class="chips mb-2">
      @for (t of types; track t) {
        <button class="chip" [class.active]="filter() === t" (click)="setFilter(t)">{{ t || 'All' }}</button>
      }
    </div>
    <div class="chips mb-4">
      @for (l of levels; track l) {
        <button class="chip sm" [class.active]="levelFilter() === l" (click)="levelFilter.set(l)">{{ l || 'All levels' }}</button>
      }
    </div>

    @if (loading()) { <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">@for (i of [1,2,3,4,5,6]; track i) { <asta-card><asta-skeleton h="130px" /></asta-card> }</div> }
    @else if (loadError()) {
      <asta-card><asta-empty-state title="Couldn't load the marketplace" description="Check your connection and try again."><asta-btn variant="ghost" (click)="load()">Retry</asta-btn></asta-empty-state></asta-card>
    }
    @else if (view().length) {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 motion-row-2">
        @for (t of view(); track t.id) {
          <asta-card class="block motion-card-reveal tpl">
            <div class="flex items-center justify-between"><span class="type">{{ t.type }}</span><span class="uses">{{ t.usageCount }} uses</span></div>
            <p class="t-title">{{ t.title }}</p>
            <p class="t-desc">{{ t.description }}</p>
            <div class="flex items-center gap-2 mt-1.5">
              @if (t.level) { <span class="lvl">{{ t.level }}</span> }
              @if (t.rating.count > 0) { <span class="rate">★ {{ t.rating.avg.toFixed(1) }} <span class="rc">({{ t.rating.count }})</span></span> }
              @else { <span class="rate norate">No ratings yet</span> }
            </div>
            <div class="flex flex-wrap gap-1 mt-2">@for (tag of t.tags.slice(0,4); track tag) { <span class="tag">{{ tag }}</span> }</div>
            <div class="flex items-center justify-between mt-3">
              <span class="creator">by {{ t.creatorName }}</span>
              <asta-btn variant="accent" size="sm" [loading]="using() === t.id" [disabled]="using() !== null" (click)="use(t)">{{ using() === t.id ? 'Cloning…' : 'Use template' }}</asta-btn>
            </div>
          </asta-card>
        }
      </div>
    } @else if (templates().length) {
      <asta-card><asta-empty-state title="No templates at this level" description="Try a different level or type filter."></asta-empty-state></asta-card>
    } @else { <asta-card><asta-empty-state title="No templates yet" description="Published templates appear here. Create one in the Creator Studio and submit it for review."><asta-btn variant="accent" (click)="go('/app/creator-studio')">Open Creator Studio</asta-btn></asta-empty-state></asta-card> }
  `,
    styles: [`
    :host { display: block; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { font-size: 12px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: pointer; text-transform: capitalize; }
    .chip.active { border-color: color-mix(in oklab, var(--green) 50%, var(--paper-3)); color: var(--green-deep); background: color-mix(in oklab, var(--green) 12%, transparent); }
    .chip.sm { font-size: 11px; padding: 4px 9px; }
    .tpl { display: flex; flex-direction: column; transition: transform .22s var(--ease), box-shadow .22s var(--ease); }
    .tpl:hover { transform: translateY(-3px); box-shadow: var(--shadow-md), 0 0 0 1px color-mix(in oklch, var(--green) 22%, transparent); }
    .type { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--peri, #8aa6ff); }
    @media (prefers-reduced-motion: reduce) { .tpl:hover { transform: none; } }
    .uses { font-size: 10.5px; color: var(--text-mute); }
    .lvl { font-size: 10px; text-transform: capitalize; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--paper-3); color: var(--text-soft); }
    .rate { font-size: 11px; color: var(--coral, #ffb454); font-weight: 600; }
    .rate .rc { color: var(--text-mute); font-weight: 400; }
    .rate.norate { color: var(--text-mute); font-weight: 400; }
    .t-title { font-size: 14px; font-weight: 600; margin-top: 6px; }
    .t-desc { font-size: 12.5px; color: var(--text-soft); margin-top: 3px; }
    .tag { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--paper-3); color: var(--text-soft); }
    .creator { font-size: 11.5px; color: var(--text-mute); }
  `]
})
export class MarketplaceComponent {
  private readonly api = inject(MarketplaceService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly types = TYPES;
  readonly levels = ['', 'beginner', 'intermediate', 'advanced'];
  readonly filter = signal('');
  readonly levelFilter = signal('');
  readonly templates = signal<Template[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly using = signal<string | null>(null);

  readonly view = computed(() => {
    const lvl = this.levelFilter();
    return lvl ? this.templates().filter((t) => t.level === lvl) : this.templates();
  });

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.list(this.filter() || undefined).subscribe({ next: (t) => { this.templates.set(t); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  setFilter(t: string): void { this.filter.set(t); this.load(); }
  use(t: Template): void {
    if (this.using() !== null) return;
    this.using.set(t.id);
    const label = t.type.replace(/_/g, ' ');
    this.api.use(t.id).subscribe({
      next: (r) => {
        this.using.set(null);
        this.toast.success(r.created ? `Cloned "${t.title}" into your ${label}` : `Starting a ${label} from "${t.title}"`);
        this.router.navigate([r.route], r.queryParams ? { queryParams: r.queryParams } : {});
      },
      error: () => { this.using.set(null); this.toast.error('Could not use this template — please try again'); },
    });
  }
  go(route: string): void { this.router.navigate([route]); }
}
