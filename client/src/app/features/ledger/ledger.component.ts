import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ShowMoreComponent } from '../../shared/ui/show-more.component';
import { windowedList } from '../../shared/utils/windowed-list';
import { ledgerKindMeta, LedgerEntry, LedgerKind, LedgerService, LedgerStats, VerificationLevel } from '../../core/services/ledger.service';

const VER_META: Record<VerificationLevel, { label: string; tone: string }> = {
  certificate: { label: 'Certificate', tone: 'var(--green-deep)' },
  mentor: { label: 'Mentor verified', tone: 'var(--green-deep)' },
  system: { label: 'System verified', tone: 'var(--peri, #8aa6ff)' },
  ai: { label: 'AI checked', tone: 'var(--peri, #8aa6ff)' },
  self: { label: 'Self-reported', tone: 'var(--text-mute)' },
};

@Component({
    selector: 'asta-ledger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent, ShowMoreComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Proof-of-Learning</h1>
        <span class="goal-pill"><span class="dot"></span>A private, verified timeline of everything you've actually learned</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        @if (filteredEntries().length) { <asta-btn variant="ghost" size="sm" (click)="exportCsv()">⬇ Export CSV</asta-btn> }
        <asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn>
      </div>
    </header>

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-3 mb-4">@for (i of [1,2,3]; track i) { <asta-card><asta-skeleton h="60px" /></asta-card> }</div>
      <asta-card><asta-skeleton h="240px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load your ledger" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else {
      @if (stats(); as s) {
        <div class="grid gap-3 sm:grid-cols-3 motion-row-primary mb-4">
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="0"><p class="num">{{ s.total }}</p><p class="lbl">Verified events</p></asta-card>
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="1"><p class="num">{{ s.activeDays }}</p><p class="lbl">Active days</p></asta-card>
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="2"><p class="num">{{ s.byKind.length }}</p><p class="lbl">Kinds of proof</p></asta-card>
        </div>
      }

      @if (entries().length === 0) {
        <asta-card class="block motion-card-reveal"><asta-empty-state title="Nothing logged yet" description="As you complete flow nodes, pass quizzes, resolve mistakes and finish simulations, each verified event lands here as proof of learning."></asta-empty-state></asta-card>
      } @else {
        <asta-card class="block motion-card-reveal motion-row-strip mb-4">
          <div class="flex items-center justify-between mb-3">
            <p class="kicker !mb-0">Activity · last 13 weeks</p>
            <span class="text-[11px] text-txt-mute">{{ recentCount() }} events</span>
          </div>
          <div class="heat" role="img" aria-label="Proof-of-learning activity over the last 13 weeks">
            @for (week of heatmap(); track $index) {
              <div class="hcol">
                @for (cell of week; track cell.date) {
                  <span class="hcell" [class.future]="cell.future" [attr.data-lvl]="level(cell.count)" [title]="cell.title"></span>
                }
              </div>
            }
          </div>
          <div class="heat-legend">
            <span>Less</span>
            <span class="hcell" data-lvl="0"></span>
            <span class="hcell" data-lvl="1"></span>
            <span class="hcell" data-lvl="2"></span>
            <span class="hcell" data-lvl="3"></span>
            <span>More</span>
          </div>
        </asta-card>

        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-3">Timeline</p>
          @if (kindsPresent().length > 1) {
            <div class="lg-chips">
              <button class="lg-chip" [class.on]="kindFilter() === 'all'" (click)="kindFilter.set('all')">All <span class="ct">{{ entries().length }}</span></button>
              @for (k of kindsPresent(); track k.kind) {
                <button class="lg-chip" [class.on]="kindFilter() === k.kind" (click)="kindFilter.set(k.kind)">{{ glyph(k.kind) }} {{ kindLabel(k.kind) }} <span class="ct">{{ k.count }}</span></button>
              }
            </div>
          }
          <div class="timeline">
            @for (e of timeline.items(); track e.id) {
              <div class="row">
                <span class="glyph">{{ glyph(e.kind) }}</span>
                <span class="line"></span>
                <span class="min-w-0 flex-1">
                  <span class="t-title">{{ e.title }} <span class="ver" [style.color]="verTone(e.verificationLevel)" [style.borderColor]="verTone(e.verificationLevel)">{{ verLabel(e.verificationLevel) }}</span></span>
                  @if (e.detail) { <span class="t-detail">{{ e.detail }}</span> }
                  <span class="t-meta">{{ kindLabel(e.kind) }} · {{ date(e.at) }}@if (e.score !== null) { · {{ e.score }}% }</span>
                </span>
              </div>
            }
          </div>
          <asta-show-more [remaining]="timeline.remaining()" [step]="40" (more)="timeline.more()" />
        </asta-card>
      }
    }
  `,
    styles: [
        `
      :host { display: block; }
      .stat { text-align: center; }
      .stat .num { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .stat .lbl { font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; }
      .heat { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 2px; }
      .hcol { display: flex; flex-direction: column; gap: 3px; }
      .hcell { width: 12px; height: 12px; border-radius: 3px; background: var(--paper-3); flex-shrink: 0; transition: transform .15s var(--ease-spring), box-shadow .15s var(--ease); }
      /* Heatmap cells pop under the cursor — the proof grid invites exploration. */
      .heat .hcell:hover { transform: scale(1.35); box-shadow: 0 0 8px var(--asta-accent-glow); }
      .hcell[data-lvl="1"] { background: color-mix(in oklab, var(--green) 30%, var(--paper-3)); }
      .hcell[data-lvl="2"] { background: color-mix(in oklab, var(--green) 58%, var(--paper-3)); }
      .hcell[data-lvl="3"] { background: linear-gradient(135deg, var(--green-deep), var(--green)); }
      .hcell.future { visibility: hidden; }
      .heat-legend { display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-top: 8px; font-size: 10px; color: var(--text-mute); }
      .heat-legend .hcell { width: 10px; height: 10px; }
      .timeline { display: flex; flex-direction: column; }
      .row { display: flex; gap: 12px; padding: 10px 0; position: relative; animation: astaRevealUp .35s var(--ease) both; transition: background .15s var(--ease); border-radius: 8px; }
      .row:nth-child(2) { animation-delay: .04s; }
      .row:nth-child(3) { animation-delay: .08s; }
      .row:nth-child(4) { animation-delay: .12s; }
      .row:hover { background: color-mix(in oklch, var(--green) 4%, transparent); }
      .glyph { font-size: 16px; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--paper-2); border: 1px solid var(--paper-3); flex-shrink: 0; z-index: 1; transition: transform .3s var(--ease-spring), border-color .2s var(--ease); }
      .row:hover .glyph { transform: scale(1.12); border-color: color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
      .line { position: absolute; left: 13px; top: 32px; bottom: -10px; width: 2px; background: var(--paper-3); }
      .row:last-child .line { display: none; }
      .t-title { display: block; font-size: 14px; font-weight: 600; }
      .t-detail { display: block; font-size: 13px; color: var(--text-soft); }
      .t-meta { display: block; font-size: 11px; color: var(--text-mute); margin-top: 2px; }
      .ver { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 1px 6px; border-radius: 999px; border: 1px solid; margin-left: 6px; vertical-align: middle; opacity: .85; }
      .lg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
      .lg-chip { font-size: 11.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
      .lg-chip:hover { border-color: var(--green); }
      .lg-chip.on { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 50%, var(--paper-3)); background: color-mix(in oklab, var(--green) 12%, transparent); }
      .lg-chip .ct { font-weight: 700; opacity: .7; }
      @media (prefers-reduced-motion: reduce) {
        .row { animation: none; }
        .heat .hcell:hover, .row:hover .glyph { transform: none; }
      }
    `,
    ]
})
export class LedgerComponent {
  private readonly api = inject(LedgerService);
  readonly entries = signal<LedgerEntry[]>([]);
  readonly stats = signal<LedgerStats | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly kindFilter = signal<'all' | LedgerKind>('all');

  readonly kindsPresent = computed(() => {
    const counts = new Map<LedgerKind, number>();
    for (const e of this.entries()) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    return [...counts.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count);
  });

  readonly filteredEntries = computed(() => {
    const k = this.kindFilter();
    return k === 'all' ? this.entries() : this.entries().filter((e) => e.kind === k);
  });

  /** Keep the proof timeline's DOM bounded as it grows; reveal 40 more on demand. */
  readonly timeline = windowedList(this.filteredEntries, 40);

  /** GitHub-style 13-week grid (columns = weeks Sun→Sat) of proof-event counts per day. */
  readonly heatmap = computed(() => {
    const weeks = 13;
    const counts = new Map<string, number>();
    for (const e of this.entries()) {
      const key = e.at.slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay())); // this week's Saturday
    const grid: { date: string; count: number; future: boolean; title: string }[][] = [];
    for (let w = 0; w < weeks; w++) {
      const col: { date: string; count: number; future: boolean; title: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(end);
        cur.setDate(end.getDate() - ((weeks - 1 - w) * 7 + (6 - d)));
        const key = cur.toISOString().slice(0, 10);
        const count = counts.get(key) ?? 0;
        col.push({ date: key, count, future: cur > today, title: `${key} · ${count} event${count === 1 ? '' : 's'}` });
      }
      grid.push(col);
    }
    return grid;
  });

  /** Events within the heatmap window (last 13 weeks). */
  readonly recentCount = computed(() => {
    const cutoff = Date.now() - 13 * 7 * 86_400_000;
    return this.entries().filter((e) => new Date(e.at).getTime() >= cutoff).length;
  });

  level(count: number): number { return count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3; }

  /** Export the (filtered) proof-of-learning timeline as CSV. */
  exportCsv(): void {
    const rows = this.filteredEntries();
    if (!rows.length) return;
    const esc = (v: unknown): string => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Date', 'Kind', 'Title', 'Detail', 'Verification', 'Score'];
    const body = rows.map((e) => [
      e.at ? new Date(e.at).toISOString().slice(0, 10) : '',
      this.kindLabel(e.kind), e.title, e.detail ?? '',
      this.verLabel(e.verificationLevel), e.score ?? '',
    ]);
    const csv = [header, ...body].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-proof-of-learning-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  constructor() { this.refresh(); }
  glyph(k: LedgerKind): string { return ledgerKindMeta(k).glyph; }
  kindLabel(k: LedgerKind): string { return ledgerKindMeta(k).label; }
  verLabel(v: VerificationLevel): string { return VER_META[v].label; }
  verTone(v: VerificationLevel): string { return VER_META[v].tone; }
  date(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.api.list().subscribe({ next: (l) => this.entries.set(l), error: () => { this.loadError.set(true); done(); }, complete: done });
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => { this.loadError.set(true); done(); }, complete: done });
  }
}
