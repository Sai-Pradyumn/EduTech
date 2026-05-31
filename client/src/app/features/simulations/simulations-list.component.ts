import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
      <div class="space-y-2 motion-row-2">
        @for (s of sims(); track s.id; let i = $index) {
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

  constructor() { this.refresh(); }
  meta(t: SimulationType) { return SIM_TYPE_META[t]; }
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
