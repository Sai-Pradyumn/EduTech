import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { SIM_TYPE_LIST, SIM_TYPE_META, Simulation, SimulationService, SimulationType } from '../../core/services/simulation.service';

@Component({
  selector: 'asta-simulations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Simulation Labs</h1>
        <span class="goal-pill"><span class="dot"></span>Real practice · rubric-scored rounds, not passive study</span>
      </div>
      <div class="flex gap-2.5 shrink-0"><asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn></div>
    </header>

    <asta-card class="block motion-card-reveal motion-row-primary mb-5">
      <p class="kicker mb-3">Start a simulation</p>
      <div class="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-end">
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Type</span>
          <select class="sim-input mt-1" [(ngModel)]="type" aria-label="Simulation type">
            @for (t of types; track t) { <option [value]="t">{{ meta(t).glyph }} {{ meta(t).label }}</option> }
          </select>
        </label>
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Topic</span>
          <input class="sim-input mt-1" [(ngModel)]="topic" (keydown.enter)="start()" placeholder="e.g. REST API design" maxlength="160" aria-label="Topic" />
        </label>
        <asta-btn variant="accent" [loading]="starting()" [disabled]="topic.trim().length < 2" (click)="start()">Start <span class="arr">→</span></asta-btn>
      </div>
    </asta-card>

    @if (loading()) {
      <asta-card><asta-skeleton h="120px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load simulations" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (sims().length === 0) {
      <asta-card class="block motion-card-reveal"><asta-empty-state title="No simulations yet" description="Pick a type and topic above — Asta runs an interview, viva, debugging or design round, scores you on a rubric, and turns weak areas into repair loops."><asta-btn variant="accent" (click)="focusTopic()">Start your first round</asta-btn></asta-empty-state></asta-card>
    } @else {
      @if (insights(); as ins) {
        <asta-card class="block motion-card-reveal motion-row-primary mb-4 insights">
          <div class="flex items-center justify-between mb-3">
            <p class="kicker !mb-0">Your simulation progress</p>
            @if (ins.delta !== null) {
              <span class="delta" [style.color]="ins.delta >= 0 ? 'var(--green-deep)' : 'var(--coral, #ffb454)'">{{ ins.delta >= 0 ? '▲' : '▼' }} {{ abs(ins.delta) }} vs previous</span>
            }
          </div>
          <div class="ins-grid">
            <div class="stat"><span class="sv" [style.color]="scoreCol(ins.best)">{{ ins.best }}</span><span class="sl">Best</span></div>
            <div class="stat"><span class="sv">{{ ins.avg }}</span><span class="sl">Average</span></div>
            <div class="stat"><span class="sv">{{ ins.count }}</span><span class="sl">Completed</span></div>
            <div class="stat"><span class="sv" [style.color]="scoreCol(ins.latest)">{{ ins.latest }}</span><span class="sl">Latest</span></div>
          </div>
          @if (ins.count >= 2) {
            <svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none"><polyline [attr.points]="sparkPoints()" fill="none" stroke="var(--peri, #8aa6ff)" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>
            <p class="spark-cap">Score across your last {{ ins.count }} simulations</p>
          }
          @if (byType().length) {
            <div class="by-type">
              @for (t of byType(); track t.type) {
                <div class="bt-row">
                  <span class="bt-label">{{ meta(t.type).glyph }} {{ meta(t.type).label }}</span>
                  <span class="bt-bar"><span class="bt-fill" [style.width.%]="t.best" [style.background]="scoreCol(t.best)"></span></span>
                  <span class="bt-val">{{ t.best }} <span class="bt-n">×{{ t.count }}</span></span>
                </div>
              }
            </div>
          }
        </asta-card>
      }

      <div class="flex flex-wrap gap-1.5 mb-2">
        <button class="fchip" [class.on]="typeFilter() === 'all'" (click)="typeFilter.set('all')">All <span class="ct">{{ sims().length }}</span></button>
        @for (t of typesPresent(); track t) {
          <button class="fchip" [class.on]="typeFilter() === t" (click)="typeFilter.set(t)">{{ meta(t).label }} <span class="ct">{{ typeCount(t) }}</span></button>
        }
      </div>
      @if (inProgressCount() > 0 && finishedCount() > 0) {
        <div class="flex flex-wrap gap-1.5 mb-3">
          <button class="fchip" [class.on]="statusFilter() === 'all'" (click)="statusFilter.set('all')">Any status</button>
          <button class="fchip" [class.on]="statusFilter() === 'active'" (click)="statusFilter.set('active')">In progress <span class="ct">{{ inProgressCount() }}</span></button>
          <button class="fchip" [class.on]="statusFilter() === 'finished'" (click)="statusFilter.set('finished')">Finished <span class="ct">{{ finishedCount() }}</span></button>
        </div>
      }

      <div class="space-y-2 motion-row-2">
        @for (s of visibleSims(); track s.id; let i = $index) {
          <asta-card class="motion-card-reveal hover-lift cursor-pointer block" [interactive]="true" [style.--motion-card-index]="i % 4" (click)="open(s)">
            <div class="flex items-center gap-3">
              <span class="glyph">{{ meta(s.type).glyph }}</span>
              <span class="min-w-0 flex-1">
                <span class="block font-medium truncate">{{ meta(s.type).label }} · {{ s.topic }}</span>
                <span class="block text-xs text-txt-mute">{{ s.difficulty }} · {{ s.transcript.length }} turns · {{ s.status }}</span>
              </span>
              @if (s.status === 'finished') { <span class="score" [class.low]="s.score < 60">{{ s.score }}</span> }
            </div>
          </asta-card>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .sim-input { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 12px; color: var(--text); font-size: 14px; }
      .sim-input:focus { outline: none; border-color: var(--green); }
      .glyph { font-size: 20px; }
      .score { font-size: 18px; font-weight: 700; color: var(--green-deep); font-variant-numeric: tabular-nums; }
      .score.low { color: var(--coral, #ffb454); }
      .insights { border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 18%, var(--paper-3)); }
      .delta { font-size: 11.5px; font-weight: 600; }
      .ins-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .stat { text-align: center; padding: 9px 6px; border-radius: 10px; background: var(--paper-2); }
      .stat .sv { display: block; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .stat .sl { display: block; font-size: 10px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; margin-top: 1px; }
      .spark { width: 100%; height: 36px; margin-top: 14px; display: block; }
      .spark-cap { font-size: 10.5px; color: var(--text-mute); text-align: center; margin-top: 2px; }
      .by-type { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--paper-3); display: flex; flex-direction: column; gap: 7px; }
      .bt-row { display: grid; grid-template-columns: 150px 1fr auto; align-items: center; gap: 10px; }
      .bt-label { font-size: 12px; color: var(--text-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bt-bar { height: 7px; border-radius: 999px; background: var(--paper-2); overflow: hidden; }
      .bt-fill { display: block; height: 100%; border-radius: 999px; transition: width .3s; }
      .bt-val { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .bt-n { font-size: 10.5px; font-weight: 500; color: var(--text-mute); }
      .fchip { font-size: 11.5px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-mute); cursor: pointer; transition: all .12s; }
      .fchip:hover { color: var(--text-soft); }
      .fchip.on { background: color-mix(in oklab, var(--green) 14%, transparent); color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 38%, transparent); }
      .fchip .ct { font-weight: 700; opacity: .8; }
    `,
  ],
})
export class SimulationsListComponent {
  private readonly api = inject(SimulationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly sims = signal<Simulation[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly starting = signal(false);
  readonly types = SIM_TYPE_LIST;
  type: SimulationType = 'interview';
  topic = '';

  readonly typeFilter = signal<'all' | SimulationType>('all');
  readonly statusFilter = signal<'all' | 'active' | 'finished'>('all');
  readonly abs = Math.abs;
  readonly inProgressCount = computed(() => this.sims().filter((s) => s.status !== 'finished').length);
  readonly finishedCount = computed(() => this.sims().filter((s) => s.status === 'finished').length);

  /** Finished sims oldest→newest (server returns newest-first). */
  private readonly finished = computed(() =>
    this.sims().filter((s) => s.status === 'finished').slice().reverse(),
  );
  readonly insights = computed(() => {
    const f = this.finished();
    if (!f.length) return null;
    const scores = f.map((s) => s.score);
    const latest = scores[scores.length - 1];
    const prev = scores.length >= 2 ? scores[scores.length - 2] : null;
    return {
      count: f.length,
      best: Math.max(...scores),
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      latest,
      delta: prev === null ? null : latest - prev,
    };
  });
  readonly byType = computed(() => {
    const map = new Map<SimulationType, { type: SimulationType; best: number; count: number }>();
    for (const s of this.finished()) {
      const e = map.get(s.type) ?? { type: s.type, best: 0, count: 0 };
      e.best = Math.max(e.best, s.score);
      e.count += 1;
      map.set(s.type, e);
    }
    return [...map.values()].sort((a, b) => b.best - a.best);
  });
  readonly sparkPoints = computed(() => {
    const scores = this.finished().map((s) => s.score);
    if (scores.length < 2) return '';
    const step = 100 / (scores.length - 1);
    return scores.map((v, i) => `${(i * step).toFixed(1)},${(30 - (v / 100) * 28).toFixed(1)}`).join(' ');
  });
  readonly typesPresent = computed(() => {
    const set = new Set(this.sims().map((s) => s.type));
    return SIM_TYPE_LIST.filter((t) => set.has(t));
  });
  readonly visibleSims = computed(() => {
    const f = this.typeFilter();
    const st = this.statusFilter();
    return this.sims().filter((s) => {
      if (f !== 'all' && s.type !== f) return false;
      if (st === 'active' && s.status === 'finished') return false;
      if (st === 'finished' && s.status !== 'finished') return false;
      return true;
    });
  });

  constructor() { this.refresh(); }
  meta(t: SimulationType) { return SIM_TYPE_META[t]; }
  typeCount(t: SimulationType): number { return this.sims().filter((s) => s.type === t).length; }
  scoreCol(v: number): string { return v >= 70 ? 'var(--green-deep)' : v >= 50 ? 'var(--coral, #ffb454)' : 'var(--danger, #ff5d5d)'; }
  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.list().subscribe({ next: (l) => { this.sims.set(l); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  focusTopic(): void { document.querySelector<HTMLInputElement>('.sim-input')?.focus(); }
  start(): void {
    if (this.topic.trim().length < 2) return;
    this.starting.set(true);
    this.api.start({ type: this.type, topic: this.topic.trim() }).subscribe({
      next: (s) => { this.starting.set(false); this.router.navigate(['/app/simulations', s.id]); },
      error: (e: Error) => { this.starting.set(false); this.toast.error(e.message || 'Could not start'); },
    });
  }
  open(s: Simulation): void { this.router.navigate(['/app/simulations', s.id]); }
}
