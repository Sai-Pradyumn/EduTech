import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import {
  MISTAKE_TYPE_LABEL,
  Mistake,
  MistakeService,
  MistakeStats,
  MistakeStatus,
  RepairAction,
} from '../../core/services/mistake.service';

type Filter = 'all' | 'due' | MistakeStatus;

@Component({
  selector: 'asta-mistakes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Mistake OS</h1>
        <span class="goal-pill"><span class="dot"></span>Turn wrong answers into repair loops — not just scores</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn>
      </div>
    </header>

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-4 mb-4">@for (i of [1,2,3,4]; track i) { <asta-card><asta-skeleton h="48px" /></asta-card> }</div>
      <asta-card><asta-skeleton h="200px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load Mistake OS" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else {
      <!-- stats strip -->
      @if (stats(); as s) {
        <div class="grid gap-3 sm:grid-cols-4 motion-row-primary mb-4">
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="0"><p class="num">{{ s.open }}</p><p class="lbl">Open</p></asta-card>
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="1"><p class="num amber">{{ s.repairing }}</p><p class="lbl">Repairing</p></asta-card>
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="2"><p class="num green">{{ s.resolved }}</p><p class="lbl">Resolved</p></asta-card>
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="3"><p class="num">{{ s.avgSeverity }}</p><p class="lbl">Avg severity</p></asta-card>
        </div>

        @if (s.due > 0) {
          <asta-card class="block motion-card-reveal motion-row-2 mb-4 due-banner">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <p class="kicker mb-1">Spaced review</p>
                <p class="font-display text-lg">{{ s.due }} concept{{ s.due === 1 ? '' : 's' }} due for review</p>
                <p class="text-xs text-txt-mute mt-0.5">A quick recall check keeps weak spots from fading — Asta reschedules each one for you.</p>
              </div>
              <asta-btn variant="accent" size="sm" (click)="setFilter('due')">Start review <span class="arr">→</span></asta-btn>
            </div>
          </asta-card>
        }

        @if (s.topFocus; as top) {
          <asta-card class="block motion-card-reveal motion-row-2 mb-4 top-focus">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <p class="kicker mb-1">Top repair focus</p>
                <p class="font-display text-lg">{{ top.concept }}</p>
                <p class="text-xs text-txt-mute mt-0.5">Highest-severity unresolved gap ({{ top.severity }}/100)</p>
              </div>
              <asta-btn variant="accent" size="sm" (click)="repairById(top.id)">Build repair plan <span class="arr">→</span></asta-btn>
            </div>
          </asta-card>
        }

        @if (s.heatmap.length) {
          <asta-card class="block motion-card-reveal motion-row-2 mb-4">
            <p class="kicker mb-3">Weakness heatmap</p>
            <div class="space-y-1.5">
              @for (h of s.heatmap; track h.topic) {
                <div class="hm-row">
                  <span class="hm-label" [title]="h.topic">{{ h.topic }}</span>
                  <span class="hm-track"><span class="hm-fill" [style.width.%]="h.severity" [style.background]="sevColor(h.severity)"></span></span>
                  <span class="hm-meta">{{ h.severity }} · ×{{ h.frequency }}</span>
                </div>
              }
            </div>
          </asta-card>
        }
      }

      <!-- filters -->
      <div class="mk-toolbar mb-3">
        <div class="view-tabs">
          @for (f of filters; track f.id) {
            <button class="view-tab" [class.active]="filter() === f.id" (click)="setFilter(f.id)">{{ f.label }}</button>
          }
        </div>
        @if (mistakes().length > 3) {
          <div class="mk-tools">
            <input class="mk-search" type="search" placeholder="Search concepts…" [ngModel]="search()" (ngModelChange)="search.set($event)" aria-label="Search mistakes" />
            @if (filter() !== 'due') {
              <select class="mk-sort" [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort mistakes">
                @for (s of sorts; track s.id) { <option [value]="s.id">{{ s.label }}</option> }
              </select>
            }
          </div>
        }
      </div>

      <!-- list -->
      @if (filtered().length === 0) {
        @if (search().trim()) {
          <asta-card class="block"><p class="text-sm text-txt-mute py-4 text-center">No concepts match “{{ search() }}”.</p></asta-card>
        } @else {
          <asta-card class="block">
            <asta-empty-state title="Nothing here" description="As you take quizzes, Asta logs the concepts you miss here and builds repair loops. Resolve them to strengthen your Skill Twin.">
              <asta-btn variant="accent" (click)="goQuiz()">Take a quiz</asta-btn>
            </asta-empty-state>
          </asta-card>
        }
      } @else {
        @if (selected().size > 0) {
          <div class="bulk-bar mb-3">
            <span class="bb-count">{{ selected().size }} selected</span>
            <button class="bb-btn" [disabled]="bulkBusy()" (click)="bulkSetStatus('resolved')">Mark resolved</button>
            <button class="bb-btn" [disabled]="bulkBusy()" (click)="bulkSetStatus('open')">Reopen</button>
            <button class="bb-btn danger" [disabled]="bulkBusy()" (click)="bulkDelete()">Delete</button>
            <button class="bb-btn" (click)="clearSel()">Clear</button>
          </div>
        }
        <div class="space-y-3 motion-row-3">
          @for (m of filtered(); track m.id; let i = $index) {
            <asta-card class="block motion-card-reveal" [class.picked]="selected().has(m.id)" [style.--motion-card-index]="i % 4">
              <div class="flex items-start gap-3 cursor-pointer" role="button" tabindex="0" [attr.aria-expanded]="expanded() === m.id" (click)="toggle(m.id)" (keyup.enter)="toggle(m.id)">
                <input type="checkbox" class="sel" [checked]="selected().has(m.id)" (click)="$event.stopPropagation()" (change)="toggleSel(m.id)" [attr.aria-label]="'Select ' + m.concept" />
                <span class="sev-dot" [style.background]="sevColor(m.severity)" [title]="'severity ' + m.severity"></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-medium">{{ m.concept }}</p>
                    <span class="type-badge">{{ typeLabel(m.mistakeType) }}</span>
                    <span class="status-badge st-{{ m.status }}">{{ m.status }}</span>
                  </div>
                  <p class="text-xs text-txt-mute mt-0.5">seen ×{{ m.frequency }} · severity {{ m.severity }}/100 · from {{ m.source }}@if (m.status !== 'resolved') { · {{ reviewHint(m) }} }</p>
                </div>
                <span class="chev" [class.open]="expanded() === m.id">▾</span>
              </div>

              @if (filter() === 'due' && m.status !== 'resolved') {
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- not interactive; only stops the review buttons' clicks from toggling the row -->
                <div class="review-mini mt-2.5" (click)="$event.stopPropagation()">
                  <span class="rm-q">Did you recall this?</span>
                  <button class="rm-btn yes" [disabled]="busyId() === m.id" (click)="review(m, true)">Recalled</button>
                  <button class="rm-btn no" [disabled]="busyId() === m.id" (click)="review(m, false)">Forgot</button>
                </div>
              }

              @if (expanded() === m.id) {
                <div class="mt-3 pl-6">
                  @if (m.status !== 'resolved') {
                    <div class="review-block mb-3">
                      <div class="min-w-0">
                        <p class="kicker mb-0.5">Spaced review</p>
                        <p class="text-xs text-txt-mute">{{ reviewHint(m) }} · reviewed ×{{ m.reviewCount }} · interval {{ m.reviewInterval }}d</p>
                      </div>
                      <div class="flex gap-2 shrink-0">
                        <button class="rm-btn yes" [disabled]="busyId() === m.id" (click)="review(m, true)">Recalled</button>
                        <button class="rm-btn no" [disabled]="busyId() === m.id" (click)="review(m, false)">Forgot</button>
                      </div>
                    </div>
                  }

                  @if (m.wrongReasoning) { <p class="text-sm mb-2"><span class="text-txt-mute">Why it happened:</span> {{ m.wrongReasoning }}</p> }
                  @if (m.correction) { <p class="text-sm mb-3"><span class="text-txt-mute">Fix:</span> {{ m.correction }}</p> }

                  @if (m.linkedQuizId || m.linkedFlowId || m.linkedVisualId) {
                    <div class="jump-row mb-3">
                      <span class="text-[11px] text-txt-mute mr-1">Where it came from:</span>
                      @if (m.linkedQuizId) { <button class="jump" (click)="jumpQuiz(m.linkedQuizId)">✓ Quiz</button> }
                      @if (m.linkedFlowId) { <button class="jump" (click)="jump(['/app/flows', m.linkedFlowId])">🧭 Flow</button> }
                      @if (m.linkedVisualId) { <button class="jump" (click)="jump(['/app/visuals', m.linkedVisualId])">◈ Visual</button> }
                    </div>
                  }

                  @if (m.lastSeenAt || m.resolvedAt) {
                    <p class="text-[11px] text-txt-mute mb-3">@if (m.lastSeenAt) { <span>Last seen {{ date(m.lastSeenAt) }}</span> }@if (m.lastSeenAt && m.resolvedAt) { <span> · </span> }@if (m.resolvedAt) { <span>Resolved {{ date(m.resolvedAt) }}</span> }</p>
                  }

                  @if (m.repairActions.length) {
                    <p class="kicker mb-2">Repair plan</p>
                    <div class="space-y-1.5 mb-3">
                      @for (a of m.repairActions; track a.id) {
                        <button class="action-row" [class.done]="a.done" (click)="runAction(m, a)">
                          <span class="ar-check">{{ a.done ? '✓' : '○' }}</span>
                          <span class="ar-label">{{ a.label }}</span>
                          <span class="ar-go">{{ a.route ? '→' : (a.kind === 'flow_repair_node' ? '+flow' : '') }}</span>
                        </button>
                      }
                    </div>
                  } @else {
                    <asta-btn variant="accent" size="sm" class="mb-3 inline-block" [loading]="busyId() === m.id" (click)="repairById(m.id)">Build repair plan</asta-btn>
                  }

                  <div class="flex gap-2 flex-wrap">
                    @if (m.status !== 'resolved') {
                      <asta-btn variant="ghost" size="sm" (click)="setStatus(m, 'resolved')">Mark resolved</asta-btn>
                    } @else {
                      <asta-btn variant="ghost" size="sm" (click)="setStatus(m, 'open')">Reopen</asta-btn>
                    }
                    <asta-btn variant="ghost" size="sm" [loading]="busyId() === m.id" (click)="addToFlow(m)">Add repair node to flow</asta-btn>
                    <asta-btn variant="ghost" size="sm" [loading]="busyId() === m.id" (click)="repairProject(m)">Generate targeted project</asta-btn>
                    <asta-btn variant="ghost" size="sm" (click)="remove(m)">Delete</asta-btn>
                  </div>
                </div>
              }
            </asta-card>
          }
        </div>
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .stat { text-align: center; }
      .stat .num { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
      .stat .num.green { color: var(--green-deep); }
      .stat .num.amber { color: var(--coral, #ffb454); }
      .stat .lbl { font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; }
      .top-focus { border: 1px solid color-mix(in oklab, var(--coral, #ffb454) 35%, var(--paper-3)); }
      .hm-row { display: grid; grid-template-columns: 150px 1fr auto; align-items: center; gap: 10px; }
      .hm-label { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .hm-track { height: 8px; border-radius: 999px; background: var(--paper-3); overflow: hidden; }
      .hm-fill { display: block; height: 100%; border-radius: 999px; transition: width .4s var(--ease); }
      .hm-meta { font-size: 11px; color: var(--text-mute); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .mk-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .mk-tools { display: flex; gap: 6px; align-items: center; }
      .mk-search { padding: 6px 11px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 12.5px; font-family: inherit; min-width: 160px; }
      .mk-search:focus { outline: none; border-color: var(--green); }
      .mk-sort { padding: 6px 9px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 12px; cursor: pointer; }
      .view-tabs { display: inline-flex; gap: 2px; background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 999px; padding: 3px; }
      .view-tab { font-size: 12px; padding: 5px 12px; border-radius: 999px; border: none; background: transparent; color: var(--text-soft); cursor: pointer; }
      .view-tab.active { background: color-mix(in oklab, var(--green) 22%, transparent); color: var(--text); }
      .sel { width: 15px; height: 15px; margin-top: 3px; flex-shrink: 0; cursor: pointer; accent-color: var(--green); }
      asta-card.picked { border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); }
      .bulk-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 11px; border-radius: 11px; border: 1px solid color-mix(in oklab, var(--green) 35%, var(--paper-3)); background: color-mix(in oklab, var(--green) 8%, transparent); }
      .bb-count { font-size: 12px; font-weight: 600; color: var(--green-deep); }
      .bb-btn { font-size: 12px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); cursor: pointer; }
      .bb-btn:hover { border-color: var(--green); }
      .bb-btn.danger:hover { border-color: var(--danger, #ff5d5d); color: var(--danger, #ff5d5d); }
      .bb-btn:disabled { opacity: .5; cursor: default; }
      .sev-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
      .type-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--paper-3); color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
      .status-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: .04em; border: 1px solid var(--paper-3); }
      .status-badge.st-open { color: var(--coral, #ffb454); }
      .status-badge.st-repairing { color: var(--peri, #8aa6ff); }
      .status-badge.st-resolved { color: var(--green-deep); }
      .chev { color: var(--text-mute); transition: transform .2s; }
      .chev.open { transform: rotate(180deg); }
      .action-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 11px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper-2); cursor: pointer; transition: border-color .2s; }
      .action-row:hover { border-color: var(--green); }
      .jump-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
      .jump { font-size: 11.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: pointer; transition: border-color .15s, color .15s; }
      .jump:hover { border-color: var(--green); color: var(--green-deep); }
      .action-row.done { opacity: .6; }
      .ar-check { color: var(--green); }
      .ar-label { flex: 1; font-size: 13px; }
      .ar-go { color: var(--text-mute); font-size: 12px; }
      .due-banner { border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 35%, var(--paper-3)); }
      .review-mini { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-left: 24px; }
      .rm-q { font-size: 12px; color: var(--text-mute); }
      .review-block { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper-2); }
      .rm-btn { font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); cursor: pointer; transition: border-color .2s, color .2s; }
      .rm-btn:disabled { opacity: .5; cursor: default; }
      .rm-btn.yes { color: var(--green-deep); }
      .rm-btn.yes:not(:disabled):hover { border-color: var(--green); }
      .rm-btn.no { color: var(--coral, #ffb454); }
      .rm-btn.no:not(:disabled):hover { border-color: var(--coral, #ffb454); }
    `,
  ],
})
export class MistakesComponent {
  private readonly api = inject(MistakeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly mistakes = signal<Mistake[]>([]);
  readonly dueList = signal<Mistake[]>([]);
  readonly stats = signal<MistakeStats | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly filter = signal<Filter>('all');
  readonly expanded = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly search = signal('');
  readonly sort = signal<'severity' | 'frequency' | 'recent'>('severity');
  readonly sorts: { id: 'severity' | 'frequency' | 'recent'; label: string }[] = [
    { id: 'severity', label: 'Severity' },
    { id: 'frequency', label: 'Most seen' },
    { id: 'recent', label: 'Recent' },
  ];

  readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'due', label: 'Review due' },
    { id: 'open', label: 'Open' },
    { id: 'repairing', label: 'Repairing' },
    { id: 'resolved', label: 'Resolved' },
  ];

  readonly filtered = computed(() => {
    const f = this.filter();
    const base = f === 'due' ? this.dueList() : f === 'all' ? this.mistakes() : this.mistakes().filter((m) => m.status === f);
    const q = this.search().trim().toLowerCase();
    const list = q
      ? base.filter((m) => `${m.concept} ${m.source}`.toLowerCase().includes(q))
      : base;
    // The "due" queue keeps its review-priority order; everything else is sortable.
    if (f === 'due') return list;
    const s = this.sort();
    const sorted = [...list];
    if (s === 'frequency') sorted.sort((a, b) => b.frequency - a.frequency);
    else if (s === 'recent') sorted.sort((a, b) => +new Date(b.lastSeenAt || 0) - +new Date(a.lastSeenAt || 0));
    else sorted.sort((a, b) => b.severity - a.severity);
    return sorted;
  });

  constructor() {
    // Deep-link support: /app/mistakes?filter=due (or open/repairing/resolved).
    const f = this.route.snapshot.queryParamMap.get('filter');
    if (f && this.filters.some((x) => x.id === f)) this.filter.set(f as Filter);
    this.refresh();
  }

  typeLabel(t: Mistake['mistakeType']): string {
    return MISTAKE_TYPE_LABEL[t];
  }
  sevColor(s: number): string {
    return s >= 75 ? 'var(--danger, #ff5d5d)' : s >= 50 ? 'var(--coral, #ffb454)' : 'var(--green)';
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    let pending = 3;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.api.list().subscribe({ next: (l) => this.mistakes.set(l), error: () => { this.loadError.set(true); done(); }, complete: done });
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => { this.loadError.set(true); done(); }, complete: done });
    this.api.due().subscribe({ next: (d) => this.dueList.set(d), error: done, complete: done });
  }

  /** Format a next-review date as a friendly relative hint. */
  reviewHint(m: Mistake): string {
    if (m.status === 'resolved') return 'resolved';
    if (!m.nextReviewAt) return 'due now';
    const ms = new Date(m.nextReviewAt).getTime() - Date.now();
    if (ms <= 0) return 'due now';
    const days = Math.round(ms / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'due today';
    if (days === 1) return 'review in 1 day';
    return `review in ${days} days`;
  }

  /** Record a spaced-review outcome and reschedule. */
  review(m: Mistake, recalled: boolean): void {
    this.busyId.set(m.id);
    this.api.review(m.id, recalled).subscribe({
      next: (upd) => {
        this.busyId.set(null);
        this.replace(upd);
        // It's no longer due (or resolved) → drop from the due queue.
        this.dueList.update((l) => l.filter((x) => x.id !== m.id));
        this.refreshStats();
        this.toast.success(recalled ? 'Nice — spaced out further' : 'Resurfacing sooner');
      },
      error: () => { this.busyId.set(null); this.toast.error('Could not save review'); },
    });
  }

  // ── bulk selection ──
  readonly selected = signal<Set<string>>(new Set());
  readonly bulkBusy = signal(false);
  toggleSel(id: string): void {
    this.selected.update((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  clearSel(): void { this.selected.set(new Set()); }

  bulkSetStatus(status: MistakeStatus): void {
    const ids = [...this.selected()];
    if (!ids.length) return;
    this.bulkBusy.set(true);
    forkJoin(ids.map((id) => this.api.setStatus(id, status))).subscribe({
      next: (updated) => {
        const byId = new Map(updated.map((u) => [u.id, u]));
        this.mistakes.update((l) => l.map((m) => byId.get(m.id) ?? m));
        this.bulkBusy.set(false);
        this.clearSel();
        this.refreshStats();
        this.toast.success(`Updated ${updated.length} concept${updated.length === 1 ? '' : 's'}`);
      },
      error: () => { this.bulkBusy.set(false); this.toast.error('Bulk update failed'); },
    });
  }

  bulkDelete(): void {
    const ids = [...this.selected()];
    if (!ids.length) return;
    this.bulkBusy.set(true);
    forkJoin(ids.map((id) => this.api.remove(id))).subscribe({
      next: () => {
        const gone = new Set(ids);
        this.mistakes.update((l) => l.filter((m) => !gone.has(m.id)));
        this.dueList.update((l) => l.filter((m) => !gone.has(m.id)));
        this.bulkBusy.set(false);
        this.clearSel();
        this.refreshStats();
        this.toast.success(`Deleted ${ids.length} concept${ids.length === 1 ? '' : 's'}`);
      },
      error: () => { this.bulkBusy.set(false); this.toast.error('Bulk delete failed'); },
    });
  }

  setFilter(f: Filter): void { this.filter.set(f); }
  toggle(id: string): void { this.expanded.set(this.expanded() === id ? null : id); }
  jump(commands: string[]): void { this.router.navigate(commands); }
  jumpQuiz(quizId: string): void { this.router.navigate(['/app/quizzes'], { queryParams: { quizId } }); }
  date(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  private replace(m: Mistake): void {
    this.mistakes.update((l) => l.map((x) => (x.id === m.id ? m : x)));
  }

  repairById(id: string): void {
    this.busyId.set(id);
    this.api.repair(id).subscribe({
      next: (m) => { this.busyId.set(null); this.replace(m); this.expanded.set(m.id); this.refreshStats(); this.toast.success('Repair plan ready'); },
      error: (e: Error) => { this.busyId.set(null); this.toast.error(e.message || 'Could not build repair plan'); },
    });
  }

  runAction(m: Mistake, a: RepairAction): void {
    if (a.kind === 'flow_repair_node') { this.addToFlow(m); return; }
    // mark done + navigate to the relevant studio with a prefilled prompt
    this.api.toggleAction(m.id, a.id, true).subscribe({ next: (upd) => this.replace(upd), error: () => undefined });
    if (a.route) {
      this.router.navigate([a.route], { queryParams: a.prompt ? { prompt: a.prompt } : undefined });
    }
  }

  addToFlow(m: Mistake): void {
    this.busyId.set(m.id);
    this.api.repairFlow(m.id).subscribe({
      next: (res) => {
        this.busyId.set(null);
        this.replace(res.mistake);
        if (res.flowId) { this.toast.success('Repair node added to your flow'); this.router.navigate(['/app/flows', res.flowId]); }
        else this.toast.warning('No active flow — generate one in Flow Studio first');
      },
      error: (e: Error) => { this.busyId.set(null); this.toast.error(e.message || 'Could not add repair node'); },
    });
  }

  repairProject(m: Mistake): void {
    this.busyId.set(m.id);
    this.api.repairProject(m.id).subscribe({
      next: (res) => { this.busyId.set(null); this.replace(res.mistake); this.toast.success('Targeted project created'); this.router.navigate(['/app/projects']); },
      error: (e: Error) => { this.busyId.set(null); this.toast.error(e.message || 'Could not create project'); },
    });
  }

  setStatus(m: Mistake, status: MistakeStatus): void {
    this.api.setStatus(m.id, status).subscribe({
      next: (upd) => { this.replace(upd); this.refreshStats(); this.toast.success(status === 'resolved' ? 'Marked resolved' : 'Reopened'); },
      error: () => this.toast.error('Could not update'),
    });
  }

  remove(m: Mistake): void {
    this.api.remove(m.id).subscribe({
      next: () => { this.mistakes.update((l) => l.filter((x) => x.id !== m.id)); this.refreshStats(); this.toast.success('Deleted'); },
      error: () => this.toast.error('Could not delete'),
    });
  }

  private refreshStats(): void {
    this.api.stats().subscribe({ next: (s) => this.stats.set(s) });
  }

  goQuiz(): void { this.router.navigate(['/app/quizzes']); }
}
