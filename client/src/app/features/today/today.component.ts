import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { DAILY_KIND_GLYPH, DailyDay, DailyItem, DailyPlan, DailyPlanMode, DailyPlanService, DailyStreak } from '../../core/services/daily-plan.service';

@Component({
  selector: 'asta-today',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Today</h1>
        <span class="goal-pill"><span class="dot"></span>Daily Autopilot · your plan, built from your flow, gaps & roadmap</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" [disabled]="busy()" (click)="carryOver()" title="Pull yesterday's unfinished items into today">Carry over</asta-btn>
        <asta-btn variant="ghost" size="sm" [disabled]="busy()" (click)="recalculate()">Recalculate</asta-btn>
      </div>
    </header>

    <div class="mode-row mb-4">
      @for (m of modes; track m.id) {
        <button class="mode-pill" [class.active]="plan()?.mode === m.id" [disabled]="busy()" (click)="setMode(m.id)" [title]="m.hint">{{ m.label }}</button>
      }
    </div>

    @if (loading()) {
      <asta-card><asta-skeleton h="200px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load today's plan" description=""><asta-btn variant="accent" (click)="load()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (plan()) {
      @if (plan()!; as p) {
      <div class="grid gap-4 lg:grid-cols-[1fr_280px] items-start">
        <asta-card class="block motion-card-reveal motion-row-primary">
          <div class="flex items-center justify-between mb-3">
            <p class="kicker !mb-0">{{ modeLabel(p.mode) }} · {{ p.totalMinutes }} min</p>
            <span class="text-xs text-txt-mute">{{ p.completed }}/{{ p.items.length }} done</span>
          </div>
          @if (p.items.length === 0) {
            <asta-empty-state title="Nothing scheduled" description="Generate a flow or take a quiz and Asta will build your day here.">
              <asta-btn variant="accent" (click)="go('/app/flows')">Open Flow Studio</asta-btn>
            </asta-empty-state>
          } @else {
            <div class="space-y-2">
              @for (it of p.items; track it.id) {
                <div class="item" [class.done]="it.done" [class.focusing]="focusId() === it.id">
                  <div class="item-row">
                    <button class="check" (click)="toggle(it)" [attr.aria-pressed]="it.done" [attr.aria-label]="it.done ? 'Mark not done' : 'Mark done'">{{ it.done ? '✓' : '' }}</button>
                    <span class="i-glyph">{{ glyph(it.kind) }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="i-title">{{ it.title }}</span>
                      <span class="i-reason">{{ it.reason }}</span>
                    </span>
                    @if (focusId() === it.id) {
                      <span class="i-timer" [class.warn]="focusLeft() <= 60">{{ fmtClock(focusLeft()) }}</span>
                      <button class="mini" (click)="stopFocus()" aria-label="Stop focus timer" title="Stop focus timer">■</button>
                    } @else {
                      <span class="i-min">{{ it.estimateMinutes }}m</span>
                      <button class="mini" (click)="startFocus(it)" [disabled]="it.done" aria-label="Start focus timer" title="Start a focus timer">▶</button>
                    }
                    <asta-btn size="sm" variant="ghost" (click)="go(it.route)">Start</asta-btn>
                  </div>

                  @if (noteEditId() === it.id) {
                    <div class="note-edit">
                      <textarea class="note-in" [value]="noteDraft()" (input)="noteDraft.set($any($event.target).value)" maxlength="500" rows="2" placeholder="Add a note or reminder…" aria-label="Item note"></textarea>
                      <div class="note-actions">
                        <asta-btn size="sm" variant="ghost" (click)="cancelNote()">Cancel</asta-btn>
                        <asta-btn size="sm" variant="accent" [disabled]="busy()" (click)="saveNote(it)">Save note</asta-btn>
                      </div>
                    </div>
                  } @else if (it.note) {
                    <button class="note-show" (click)="editNote(it)" title="Edit note">📝 {{ it.note }}</button>
                  } @else {
                    <button class="note-add" (click)="editNote(it)">+ Add note</button>
                  }
                </div>
              }
            </div>
          }
        </asta-card>

        <div class="space-y-4">
          @if (streak(); as st) {
            <asta-card class="block motion-card-reveal motion-row-2 streak-card">
              <div class="flex items-center gap-3">
                <span class="flame" [class.cold]="!st.activeToday && st.current === 0">🔥</span>
                <div class="min-w-0">
                  <p class="streak-n">{{ st.current }}<span class="streak-u">day{{ st.current === 1 ? '' : 's' }}</span></p>
                  <p class="text-[11px] text-txt-mute">{{ st.activeToday ? 'Active today — nice!' : (st.current > 0 ? 'Finish one item to keep it alive' : 'Complete an item to start a streak') }}</p>
                </div>
              </div>
              @if (history().length) {
                <div class="week-strip" role="img" aria-label="Activity over the last 7 days">
                  @for (d of history(); track d.date) {
                    <span class="wk-day" [class.on]="d.active" [title]="d.date + ' · ' + d.completed + '/' + d.total + ' done'">{{ dayLetter(d.date) }}</span>
                  }
                </div>
              }
              <div class="flex justify-between text-[11px] text-txt-mute mt-3 pt-2.5" style="border-top:1px solid var(--paper-3)">
                <span>Best: <b>{{ st.best }}</b> day{{ st.best === 1 ? '' : 's' }}</span>
                <span>{{ st.totalActiveDays }} active total</span>
              </div>
            </asta-card>
          }
          <asta-card class="block motion-card-reveal motion-row-2 text-center">
            <p class="ring-num">{{ pct() }}%</p>
            <div class="prog-track"><span class="prog-fill" [style.width.%]="pct()"></span></div>
            <p class="text-xs text-txt-mute mt-2">of today's plan complete</p>
          </asta-card>
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-2">Quick modes</p>
            <div class="grid gap-2">
              <asta-btn variant="ghost" size="sm" [disabled]="busy()" (click)="setMode('quick')">⏱ I only have 20 minutes</asta-btn>
              <asta-btn variant="ghost" size="sm" [disabled]="busy()" (click)="setMode('exam')">📝 Exam tomorrow</asta-btn>
              <asta-btn variant="ghost" size="sm" [disabled]="busy()" (click)="setMode('burnout_recovery')">🌙 Burnout recovery</asta-btn>
            </div>
          </asta-card>
        </div>
      </div>
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .mode-row { display: inline-flex; gap: 2px; background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 999px; padding: 3px; }
      .mode-pill { font-size: 12px; padding: 5px 12px; border-radius: 999px; border: none; background: transparent; color: var(--text-soft); cursor: pointer; }
      .mode-pill.active { background: color-mix(in oklab, var(--green) 22%, transparent); color: var(--text); }
      .item { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--paper-3); background: var(--paper-2); }
      .item.focusing { border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); }
      .item-row { display: flex; align-items: center; gap: 10px; }
      .item.done { opacity: .55; }
      .item.done .i-title { text-decoration: line-through; }
      .check { width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid var(--paper-3); background: transparent; color: var(--green); cursor: pointer; flex-shrink: 0; font-size: 13px; }
      .i-glyph { font-size: 16px; }
      .i-title { display: block; font-size: 14px; font-weight: 600; }
      .i-reason { display: block; font-size: 11px; color: var(--text-mute); }
      .i-min { font-size: 11px; color: var(--text-mute); white-space: nowrap; }
      .i-timer { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--green); white-space: nowrap; }
      .i-timer.warn { color: var(--coral, #ffb454); }
      .mini { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--paper-3); background: transparent; color: var(--text-soft); cursor: pointer; font-size: 11px; flex-shrink: 0; }
      .mini:disabled { opacity: .4; cursor: default; }
      .note-show { text-align: left; font-size: 12px; color: var(--text-soft); background: var(--paper-3); border: none; border-radius: 8px; padding: 5px 9px; cursor: pointer; }
      .note-add { align-self: flex-start; font-size: 11px; color: var(--text-mute); background: transparent; border: none; cursor: pointer; padding: 0 2px; }
      .note-edit { display: flex; flex-direction: column; gap: 6px; }
      .note-in { width: 100%; resize: vertical; font: inherit; font-size: 13px; border-radius: 8px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text); padding: 6px 8px; }
      .note-actions { display: flex; justify-content: flex-end; gap: 6px; }
      .streak-card { border: 1px solid color-mix(in oklab, var(--coral, #ffb454) 28%, var(--paper-3)); }
      .flame { font-size: 30px; line-height: 1; filter: drop-shadow(0 0 8px color-mix(in oklab, var(--coral, #ffb454) 50%, transparent)); }
      .flame.cold { filter: grayscale(1); opacity: .5; }
      .streak-n { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
      .streak-u { font-size: 12px; font-weight: 500; color: var(--text-mute); margin-left: 6px; }
      .week-strip { display: flex; gap: 5px; margin-top: 12px; }
      .wk-day { flex: 1; aspect-ratio: 1; display: grid; place-items: center; border-radius: 7px; font-size: 9px; font-family: var(--mono); color: var(--text-mute); background: var(--paper-3); }
      .wk-day.on { color: var(--ink); background: linear-gradient(135deg, var(--green-deep), var(--green)); font-weight: 700; }
      .ring-num { font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .prog-track { height: 6px; border-radius: 999px; background: var(--paper-3); overflow: hidden; }
      .prog-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--green-deep), var(--green)); transition: width .4s var(--ease); }
    `,
  ],
})
export class TodayComponent implements OnDestroy {
  private readonly api = inject(DailyPlanService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly plan = signal<DailyPlan | null>(null);
  readonly streak = signal<DailyStreak | null>(null);
  readonly history = signal<DailyDay[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal(false);

  // Per-item note editor + client-side focus timer.
  readonly noteEditId = signal<string | null>(null);
  readonly noteDraft = signal('');
  readonly focusId = signal<string | null>(null);
  readonly focusLeft = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  readonly modes: { id: DailyPlanMode; label: string; hint: string }[] = [
    { id: 'normal', label: 'Today', hint: 'A balanced daily plan' },
    { id: 'quick', label: 'Quick', hint: 'Only 20 minutes' },
    { id: 'exam', label: 'Exam', hint: 'Exam tomorrow' },
    { id: 'burnout_recovery', label: 'Recover', hint: 'Light, low-pressure' },
  ];

  readonly pct = computed(() => {
    const p = this.plan();
    return p && p.items.length ? Math.round((p.completed / p.items.length) * 100) : 0;
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.today().subscribe({
      next: (p) => { this.plan.set(p); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
    this.refreshStreak();
  }

  private refreshStreak(): void {
    this.api.streak().subscribe({ next: (s) => this.streak.set(s), error: () => undefined });
    this.api.history(7).subscribe({ next: (h) => this.history.set(h), error: () => undefined });
  }

  /** Single-letter weekday for the activity strip (M T W T F S S). */
  dayLetter(iso: string): string {
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${iso}T00:00:00`).getDay()];
  }

  glyph(k: DailyItem['kind']): string { return DAILY_KIND_GLYPH[k]; }
  modeLabel(m: DailyPlanMode): string { return this.modes.find((x) => x.id === m)?.label ?? m; }
  go(route: string): void { this.router.navigate([route]); }

  setMode(mode: DailyPlanMode): void {
    this.busy.set(true);
    this.api.generate(mode).subscribe({
      next: (p) => { this.plan.set(p); this.busy.set(false); },
      error: () => { this.busy.set(false); this.toast.error('Could not build plan'); },
    });
  }

  recalculate(): void {
    this.busy.set(true);
    this.api.recalculate().subscribe({
      next: (p) => { this.plan.set(p); this.busy.set(false); this.toast.success('Plan recalculated'); },
      error: () => { this.busy.set(false); this.toast.error('Could not recalculate'); },
    });
  }

  toggle(it: DailyItem): void {
    this.api.completeItem(it.id).subscribe({
      next: (p) => { this.plan.set(p); this.refreshStreak(); },
      error: () => this.toast.error('Could not update item'),
    });
  }

  carryOver(): void {
    const before = this.plan()?.items.length ?? 0;
    this.busy.set(true);
    this.api.carryOver().subscribe({
      next: (p) => {
        this.plan.set(p);
        this.busy.set(false);
        const added = p.items.length - before;
        this.toast.success(added > 0 ? `Carried over ${added} item${added === 1 ? '' : 's'} from yesterday` : 'Nothing to carry over');
      },
      error: () => { this.busy.set(false); this.toast.error('Could not carry over'); },
    });
  }

  // ── per-item notes ──
  editNote(it: DailyItem): void { this.noteEditId.set(it.id); this.noteDraft.set(it.note ?? ''); }
  cancelNote(): void { this.noteEditId.set(null); this.noteDraft.set(''); }
  saveNote(it: DailyItem): void {
    this.busy.set(true);
    this.api.setItemNote(it.id, this.noteDraft().trim()).subscribe({
      next: (p) => { this.plan.set(p); this.busy.set(false); this.noteEditId.set(null); },
      error: () => { this.busy.set(false); this.toast.error('Could not save note'); },
    });
  }

  // ── client-side focus timer ──
  startFocus(it: DailyItem): void {
    this.stopFocus();
    this.focusId.set(it.id);
    this.focusLeft.set(Math.max(1, it.estimateMinutes) * 60);
    this.timer = setInterval(() => {
      const left = this.focusLeft() - 1;
      if (left <= 0) {
        this.stopFocus();
        this.toast.success('Focus session complete — nice work!');
      } else {
        this.focusLeft.set(left);
      }
    }, 1000);
  }
  stopFocus(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    this.focusId.set(null);
    this.focusLeft.set(0);
  }
  fmtClock(s: number): string {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  ngOnDestroy(): void { this.stopFocus(); }
}
