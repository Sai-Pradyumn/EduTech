import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { LoadErrorComponent } from '../../shared/ui/load-error.component';
import { OfflineNoticeComponent } from '../../shared/ui/offline-notice.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import {
  LearningResource,
  ResourceKind,
  ResourceLevel,
  ResourceProgress,
  ResourcesService,
  SuggestResourceInput,
} from '../../core/services/resources.service';

const KINDS: { key: ResourceKind | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'course', label: 'Courses' },
  { key: 'docs', label: 'Docs' },
  { key: 'practice', label: 'Practice' },
  { key: 'book', label: 'Books' },
  { key: 'article', label: 'Articles' },
  { key: 'tool', label: 'Tools' },
];
const LEVELS: { key: ResourceLevel | ''; label: string }[] = [
  { key: '', label: 'Any level' },
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

/** A→Z Resources: curated catalog + personalized picks + personal library. */
@Component({
  selector: 'asta-resources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, LoadErrorComponent, SkeletonComponent, OfflineNoticeComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Resources</h1>
        <span class="goal-pill"><span class="dot"></span>Curated learning, matched to your goal and weak areas</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="suggesting.set(!suggesting())">{{ suggesting() ? 'Close' : '＋ Suggest a resource' }}</asta-btn>
        <asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn>
      </div>
    </header>

    <asta-offline-notice context="The catalog can't refresh" />

    <!-- Community submission — pending until an admin approves -->
    @if (suggesting()) {
      <div class="card mb-5 motion-card-reveal" style="padding:18px">
        <p class="kicker mb-1">Suggest a resource</p>
        <p class="text-[12px] text-txt-mute mb-3">Share something genuinely useful — it stays visible only to you until an admin approves it into the catalog.</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <input class="res-input" [(ngModel)]="sgTitle" placeholder="Title" aria-label="Resource title" />
          <input class="res-input" [(ngModel)]="sgUrl" placeholder="https://…" aria-label="Resource URL" />
          <input class="res-input" [(ngModel)]="sgProvider" placeholder="Provider (e.g. MDN)" aria-label="Provider" />
          <input class="res-input" [(ngModel)]="sgTopics" placeholder="topics, comma, separated" aria-label="Topics" />
          <select class="res-input" [(ngModel)]="sgKind" aria-label="Kind">
            @for (k of kinds; track k.key) { @if (k.key) { <option [value]="k.key">{{ k.label }}</option> } }
          </select>
          <select class="res-input" [(ngModel)]="sgLevel" aria-label="Level">
            @for (l of levels; track l.key) { @if (l.key) { <option [value]="l.key">{{ l.label }}</option> } }
          </select>
        </div>
        <textarea class="res-input mt-2 w-full" rows="2" [(ngModel)]="sgDesc" placeholder="One honest sentence on why it's worth someone's time" aria-label="Description"></textarea>
        <div class="mt-3">
          <asta-btn variant="accent" size="sm" [disabled]="!canSuggest() || suggestBusy()" (click)="suggest()">{{ suggestBusy() ? 'Submitting…' : 'Submit for review' }}</asta-btn>
        </div>
      </div>
    }

    <!-- For you -->
    @if (loadingForYou()) {
      <asta-card class="block mb-5"><asta-skeleton h="90px" /></asta-card>
    } @else if (forYou().length) {
      <div class="card mb-5 motion-card-reveal" style="padding:18px">
        <p class="kicker mb-3">Picked for you</p>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 motion-stagger">
          @for (r of forYou(); track r.id; let i = $index) {
            <div class="res" [style.--motion-card-index]="i % 3">
              @if (r.reason) { <span class="why">{{ r.reason }}</span> }
              <div class="res-meta">{{ r.provider }} · {{ kindLabel(r.kind) }} · {{ r.level }}@if (r.minutes) { · ~{{ hours(r.minutes) }}}</div>
              <a class="res-title" [href]="r.url" target="_blank" rel="noopener noreferrer">{{ r.title }} ↗</a>
              <p class="res-desc">{{ r.description }}</p>
              <div class="res-actions">
                <asta-btn variant="accent" size="sm" (click)="cycle(r)">{{ actionLabel(r.progress) }}</asta-btn>
                @if (r.progress) { <span class="pill state-{{ r.progress }}">{{ stateLabel(r.progress) }}</span> }
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- My library -->
    @if (library().length) {
      <div class="card mb-5 motion-card-reveal motion-row-2" style="padding:18px">
        <div class="flex items-center justify-between mb-3">
          <p class="kicker !mb-0">My library</p>
          <span class="t-label">{{ doneCount() }} done · {{ library().length }} total</span>
        </div>
        <div class="space-y-1.5">
          @for (r of library(); track r.id) {
            <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
              <span class="pill shrink-0 state-{{ r.progress }}">{{ stateLabel(r.progress!) }}</span>
              <a class="min-w-0 flex-1 truncate hover:underline" [href]="r.url" target="_blank" rel="noopener noreferrer">{{ r.title }}</a>
              <span class="t-label shrink-0 hidden sm:inline">{{ r.provider }}</span>
              <asta-btn variant="ghost" size="sm" (click)="cycle(r)">{{ actionLabel(r.progress) }}</asta-btn>
            </div>
          }
        </div>
      </div>
    }

    <!-- Catalog -->
    <div class="card motion-card-reveal motion-row-3" style="padding:18px">
      <p class="kicker mb-3">Browse the catalog</p>
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <input class="res-input" [(ngModel)]="q" (keydown.enter)="search()" placeholder="Search title, topic, provider…" aria-label="Search resources" />
        <asta-btn variant="ghost" size="sm" (click)="search()">Search</asta-btn>
      </div>
      <div class="flex flex-wrap gap-1.5 mb-2">
        @for (k of kinds; track k.key) {
          <button type="button" class="seg" [class.seg-on]="kind() === k.key" (click)="setKind(k.key)">{{ k.label }}</button>
        }
      </div>
      <div class="flex flex-wrap gap-1.5 mb-4">
        @for (l of levels; track l.key) {
          <button type="button" class="seg" [class.seg-on]="level() === l.key" (click)="setLevel(l.key)">{{ l.label }}</button>
        }
      </div>

      @if (loading()) {
        <asta-skeleton h="200px" />
      } @else if (catalog().length === 0) {
        <asta-empty-state title="No resources match" description="Try a different search, kind or level.">
          <asta-btn variant="accent" (click)="clearFilters()">Clear filters</asta-btn>
        </asta-empty-state>
      } @else {
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 motion-stagger">
          @for (r of catalog(); track r.id; let i = $index) {
            <div class="res" [style.--motion-card-index]="i % 3">
              <div class="res-meta">{{ r.provider }} · {{ kindLabel(r.kind) }} · {{ r.level }}@if (r.minutes) { · ~{{ hours(r.minutes) }}}@if (!r.free) { · paid }</div>
              @if (r.status === 'pending') { <span class="why" style="color:var(--amber-deep,#b45309)">⏳ pending review — visible only to you</span> }
              <a class="res-title" [href]="r.url" target="_blank" rel="noopener noreferrer">{{ r.title }} ↗</a>
              <p class="res-desc">{{ r.description }}</p>
              <div class="res-topics">
                @for (t of r.topics.slice(0, 4); track t) {
                  <button type="button" class="tpc" (click)="setTopic(t)">{{ t }}</button>
                }
              </div>
              <div class="res-actions">
                <asta-btn [variant]="r.progress ? 'ghost' : 'accent'" size="sm" (click)="cycle(r)">{{ actionLabel(r.progress) }}</asta-btn>
                <button type="button" class="upv" [class.on]="r.hasUpvoted" (click)="upvote(r)" [attr.aria-label]="(r.hasUpvoted ? 'Remove upvote from ' : 'Upvote ') + r.title">▲ {{ r.upvotes }}</button>
                @if (r.progress) { <span class="pill state-{{ r.progress }}">{{ stateLabel(r.progress) }}</span> }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .res{display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:12px;border:1px solid var(--paper-3);background:var(--paper-2);transition:border-color .2s var(--ease),transform .2s var(--ease)}
    .res:hover{border-color:color-mix(in oklab,var(--green) 45%,transparent);transform:translateY(-2px)}
    .why{align-self:flex-start;font-size:10.5px;letter-spacing:.02em;padding:2px 8px;border-radius:999px;background:color-mix(in oklab,var(--green) 14%,var(--paper));color:var(--green-deep);border:1px solid color-mix(in oklab,var(--green) 30%,transparent)}
    .res-meta{font-size:11px;color:var(--txt-mute);font-family:var(--font-mono,monospace)}
    .res-title{font-weight:600;line-height:1.35;color:var(--ink);text-decoration:none}
    .res-title:hover{text-decoration:underline}
    .res-desc{font-size:12.5px;color:var(--txt-soft);line-height:1.5;flex:1}
    .res-topics{display:flex;flex-wrap:wrap;gap:4px}
    .tpc{font-size:10.5px;padding:2px 8px;border-radius:999px;background:var(--paper-3);color:var(--txt-mute);border:none;cursor:pointer;transition:all .15s var(--ease)}
    .tpc:hover{background:var(--green);color:var(--paper)}
    .res-actions{display:flex;align-items:center;gap:8px;margin-top:2px}
    .res-input{flex:1;min-width:220px;padding:8px 12px;border-radius:9px;border:1px solid var(--paper-3);background:var(--paper);color:var(--ink);font-size:13.5px}
    .res-input:focus{outline:none;border-color:var(--green)}
    .seg{font-size:12px;padding:5px 11px;border-radius:999px;border:1px solid var(--paper-3);background:var(--paper-2);color:var(--txt-soft);cursor:pointer;transition:all .15s var(--ease)}
    .seg:hover{border-color:var(--green)}
    .seg-on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
    .upv{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;border:1px solid var(--paper-3);background:var(--paper);color:var(--txt-soft);cursor:pointer;transition:all .15s var(--ease)}
    .upv:hover{border-color:var(--green);color:var(--green-deep)}
    .upv.on{border-color:var(--green);color:var(--green-deep);background:color-mix(in oklab,var(--green) 12%,transparent)}
    .state-saved{color:var(--peri-deep)}
    .state-in_progress{color:var(--amber-deep,#b45309)}
    .state-done{color:var(--green-deep)}
  `],
})
export class ResourcesComponent implements OnInit {
  private readonly api = inject(ResourcesService);
  private readonly toast = inject(ToastService);

  readonly kinds = KINDS;
  readonly levels = LEVELS;

  readonly forYou = signal<LearningResource[]>([]);
  readonly catalog = signal<LearningResource[]>([]);
  readonly library = signal<LearningResource[]>([]);
  readonly loading = signal(true);
  readonly loadingForYou = signal(true);
  readonly kind = signal<ResourceKind | ''>('');
  readonly level = signal<ResourceLevel | ''>('');
  readonly topic = signal('');
  q = '';

  readonly doneCount = computed(
    () => this.library().filter((r) => r.progress === 'done').length,
  );

  // ── community submission ──
  readonly suggesting = signal(false);
  readonly suggestBusy = signal(false);
  sgTitle = '';
  sgUrl = '';
  sgProvider = '';
  sgTopics = '';
  sgKind: ResourceKind = 'article';
  sgLevel: ResourceLevel = 'beginner';
  sgDesc = '';

  canSuggest(): boolean {
    return this.sgTitle.trim().length >= 3 && /^https?:\/\/\S+/.test(this.sgUrl.trim()) && this.sgProvider.trim().length >= 2;
  }

  suggest(): void {
    if (!this.canSuggest() || this.suggestBusy()) return;
    this.suggestBusy.set(true);
    const input: SuggestResourceInput = {
      title: this.sgTitle.trim(),
      url: this.sgUrl.trim(),
      provider: this.sgProvider.trim(),
      kind: this.sgKind,
      level: this.sgLevel,
      topics: this.sgTopics.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6),
      description: this.sgDesc.trim() || undefined,
    };
    this.api.suggest(input).subscribe({
      next: (r) => {
        this.suggestBusy.set(false);
        this.suggesting.set(false);
        this.sgTitle = this.sgUrl = this.sgProvider = this.sgTopics = this.sgDesc = '';
        this.catalog.update((list) => [r, ...list]);
        this.toast.success('Submitted — it stays visible only to you until an admin approves it');
      },
      error: (e) => {
        this.suggestBusy.set(false);
        this.toast.error(e?.message ?? 'Could not submit');
      },
    });
  }

  upvote(r: LearningResource): void {
    this.api.upvote(r.id).subscribe({
      next: (updated) => {
        const patch = (list: LearningResource[]) =>
          list.map((x) => (x.id === r.id ? { ...x, upvotes: updated.upvotes, hasUpvoted: updated.hasUpvoted } : x));
        this.catalog.update(patch);
        this.forYou.update(patch);
        this.library.update(patch);
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not upvote'),
    });
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loadingForYou.set(true);
    this.api.forYou().subscribe({
      next: (list) => { this.forYou.set(list); this.loadingForYou.set(false); },
      error: () => this.loadingForYou.set(false),
    });
    this.api.library().subscribe({ next: (list) => this.library.set(list) });
    this.search();
  }

  search(): void {
    this.loading.set(true);
    this.api
      .list({
        q: this.q.trim() || undefined,
        kind: this.kind() || undefined,
        level: this.level() || undefined,
        topic: this.topic() || undefined,
      })
      .subscribe({
        next: (list) => { this.catalog.set(list); this.loading.set(false); },
        error: () => { this.catalog.set([]); this.loading.set(false); },
      });
  }

  setKind(k: ResourceKind | ''): void { this.kind.set(k); this.search(); }
  setLevel(l: ResourceLevel | ''): void { this.level.set(l); this.search(); }
  setTopic(t: string): void { this.topic.set(t); this.q = ''; this.search(); }
  clearFilters(): void {
    this.q = ''; this.kind.set(''); this.level.set(''); this.topic.set('');
    this.search();
  }

  /** Save → Start → Done → back out of the library. */
  cycle(r: LearningResource): void {
    const next: ResourceProgress | null =
      r.progress === null ? 'saved'
      : r.progress === 'saved' ? 'in_progress'
      : r.progress === 'in_progress' ? 'done'
      : null;
    const apply = (progress: ResourceProgress | null) => {
      const patch = (list: LearningResource[]) =>
        list.map((x) => (x.id === r.id ? { ...x, progress } : x));
      this.forYou.update(patch);
      this.catalog.update(patch);
      this.api.library().subscribe({ next: (l) => this.library.set(l) });
    };
    if (next === null) {
      this.api.clearProgress(r.id).subscribe({
        next: () => { apply(null); this.toast.success('Removed from your library'); },
        error: () => this.toast.error('Could not update — try again'),
      });
      return;
    }
    this.api.setProgress(r.id, next).subscribe({
      next: () => {
        apply(next);
        if (next === 'done') this.toast.success('Nice — marked done ✓');
      },
      error: () => this.toast.error('Could not update — try again'),
    });
  }

  actionLabel(p: ResourceProgress | null): string {
    return p === null ? 'Save'
      : p === 'saved' ? 'Start'
      : p === 'in_progress' ? 'Mark done'
      : 'Remove';
  }
  stateLabel(p: ResourceProgress): string {
    return p === 'saved' ? 'saved' : p === 'in_progress' ? 'in progress' : 'done';
  }
  kindLabel(k: ResourceKind): string {
    return KINDS.find((x) => x.key === k)?.label.replace(/s$/, '') ?? k;
  }
  hours(minutes: number): string {
    return minutes >= 90 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
  }
}
