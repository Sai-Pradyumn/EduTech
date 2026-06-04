import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { LEDGER_KIND_META, LedgerEntry, LedgerKind, LedgerService, LedgerStats, VerificationLevel } from '../../core/services/ledger.service';

const VER_META: Record<VerificationLevel, { label: string; tone: string }> = {
  certificate: { label: 'Certificate', tone: 'var(--green-deep)' },
  mentor: { label: 'Mentor verified', tone: 'var(--green-deep)' },
  system: { label: 'System verified', tone: 'var(--peri, #8aa6ff)' },
  ai: { label: 'AI checked', tone: 'var(--peri, #8aa6ff)' },
  self: { label: 'Self-reported', tone: 'var(--text-mute)' },
};

@Component({
  selector: 'asta-ledger',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Proof-of-Learning</h1>
        <span class="goal-pill"><span class="dot"></span>A private, verified timeline of everything you've actually learned</span>
      </div>
      <div class="flex gap-2.5 shrink-0"><asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn></div>
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
            @for (e of filteredEntries(); track e.id) {
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
      .timeline { display: flex; flex-direction: column; }
      .row { display: flex; gap: 12px; padding: 10px 0; position: relative; }
      .glyph { font-size: 16px; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--paper-2); border: 1px solid var(--paper-3); flex-shrink: 0; z-index: 1; }
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
    `,
  ],
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

  constructor() { this.refresh(); }
  glyph(k: LedgerKind): string { return LEDGER_KIND_META[k].glyph; }
  kindLabel(k: LedgerKind): string { return LEDGER_KIND_META[k].label; }
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
