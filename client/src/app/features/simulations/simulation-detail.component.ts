import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { SIM_TYPE_META, Simulation, SimulationService, SimulationType } from '../../core/services/simulation.service';

@Component({
  selector: 'asta-simulation-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ sim() ? meta(sim()!.type).label + ' · ' + sim()!.topic : 'Simulation' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ sim() ? sim()!.role + ' · ' + sim()!.difficulty : 'Loading…' }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="back()">All labs</asta-btn>
        @if (sim() && sim()!.status === 'active') { <asta-btn variant="accent" size="sm" [loading]="finishing()" (click)="finish()">Finish & score</asta-btn> }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="360px" /></asta-card>
    } @else if (loadError() || !sim()) {
      <asta-card><asta-empty-state title="Could not load this simulation" description=""><asta-btn variant="accent" (click)="reload()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else {
      <div class="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
        <div class="min-w-0 space-y-4">
          <asta-card class="block motion-card-reveal motion-row-primary">
            <p class="kicker mb-3">Transcript</p>
            <div class="space-y-2.5">
              @for (t of sim()!.transcript; track $index) {
                <div class="turn" [class.you]="t.role === 'user'">
                  <span class="who">{{ t.role === 'user' ? 'You' : 'Coach' }}</span>
                  <span class="text">{{ t.text }}</span>
                </div>
              }
            </div>
            @if (sim()!.status === 'active') {
              <div class="reply mt-3">
                <textarea class="sim-input" [(ngModel)]="reply" rows="2" placeholder="Type your response…" [disabled]="responding()" aria-label="Your response"></textarea>
                <asta-btn variant="accent" size="sm" class="mt-1.5 inline-block" [loading]="responding()" [disabled]="reply.trim().length < 1" (click)="respond()">Respond</asta-btn>
              </div>
            }
          </asta-card>

          @if (sim()!.status === 'finished') {
            <asta-card class="block motion-card-reveal motion-row-2">
              <div class="flex items-center justify-between mb-2">
                <p class="kicker !mb-0">Result</p>
                <span class="score" [class.low]="sim()!.score < 60">{{ sim()!.score }}/100</span>
              </div>
              <p class="text-sm text-txt-soft">{{ sim()!.feedback }}</p>
              @if (sim()!.improvementPlan.length) {
                <p class="kicker mt-3 mb-1">Improvement plan</p>
                <ul class="text-sm text-txt-soft space-y-0.5">@for (p of sim()!.improvementPlan; track p) { <li>• {{ p }}</li> }</ul>
              }
              <div class="flex gap-2 mt-3 flex-wrap">
                <asta-btn variant="ghost" size="sm" (click)="retry(false)">Retry easier</asta-btn>
                <asta-btn variant="ghost" size="sm" (click)="retry(true)">Retry harder</asta-btn>
                <asta-btn variant="ghost" size="sm" [loading]="repairing()" (click)="repairFlow()">Add repair node to flow</asta-btn>
              </div>
            </asta-card>
          }
        </div>

        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-2">Rubric</p>
          <div class="space-y-2">
            @for (c of sim()!.rubric; track c.criterion) {
              <div class="rub-row">
                <span class="rub-c">{{ c.criterion }}</span>
                <span class="rub-track"><span class="rub-fill" [style.width.%]="c.score" [style.background]="c.score >= 70 ? 'var(--green)' : 'var(--coral, #ffb454)'"></span></span>
                <span class="rub-s" [style.color]="c.score >= 70 ? 'var(--green-deep)' : 'var(--text-soft)'">{{ c.score }}</span>
              </div>
            }
          </div>
          @if (sim()!.linkedSkills.length) {
            <p class="kicker mt-3 mb-1.5">Skills tested</p>
            <div class="skill-tags">@for (s of sim()!.linkedSkills; track s) { <span class="skill-tag">{{ s }}</span> }</div>
          }
          @if (sim()!.scenario) { <p class="kicker mt-3 mb-1">Scenario</p><p class="text-sm text-txt-soft">{{ sim()!.scenario }}</p> }
        </asta-card>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .sim-input { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 9px 12px; color: var(--text); font-size: 14px; font-family: inherit; }
      .sim-input:focus { outline: none; border-color: var(--green); }
      .turn { display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border-radius: 12px; background: var(--paper-2); border: 1px solid var(--paper-3); }
      .turn.you { background: color-mix(in oklab, var(--green) 8%, var(--paper-2)); }
      .who { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-mute); }
      .text { font-size: 14px; }
      .score { font-size: 20px; font-weight: 700; color: var(--green-deep); font-variant-numeric: tabular-nums; }
      .score.low { color: var(--coral, #ffb454); }
      .rub-row { display: grid; grid-template-columns: 110px 1fr 28px; align-items: center; gap: 8px; }
      .rub-c { font-size: 12px; }
      .rub-track { height: 7px; border-radius: 999px; background: var(--paper-3); overflow: hidden; }
      .rub-fill { display: block; height: 100%; }
      .rub-s { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
      .skill-tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .skill-tag { font-size: 11.5px; padding: 2px 9px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 35%, var(--paper-3)); color: var(--peri, #8aa6ff); }
    `,
  ],
})
export class SimulationDetailComponent {
  private readonly api = inject(SimulationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly sim = signal<Simulation | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly responding = signal(false);
  readonly finishing = signal(false);
  readonly repairing = signal(false);
  reply = '';

  constructor() { this.reload(); }
  meta(t: SimulationType) { return SIM_TYPE_META[t]; }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loadError.set(true); this.loading.set(false); return; }
    this.loading.set(true); this.loadError.set(false);
    this.api.get(id).subscribe({ next: (s) => { this.sim.set(s); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  private id(): string { return this.sim()!.id; }

  respond(): void {
    if (this.reply.trim().length < 1) return;
    const msg = this.reply.trim();
    this.reply = '';
    this.responding.set(true);
    this.api.respond(this.id(), msg).subscribe({
      next: (s) => { this.sim.set(s); this.responding.set(false); },
      error: (e: Error) => { this.responding.set(false); this.toast.error(e.message || 'Could not respond'); },
    });
  }
  finish(): void {
    this.finishing.set(true);
    this.api.finish(this.id()).subscribe({ next: (s) => { this.sim.set(s); this.finishing.set(false); this.toast.success(`Scored ${s.score}/100`); }, error: () => { this.finishing.set(false); this.toast.error('Could not finish'); } });
  }
  retry(harder: boolean): void {
    this.api.retry(this.id(), harder).subscribe({ next: (s) => { this.toast.success('New round started'); this.router.navigate(['/app/simulations', s.id]); }, error: () => this.toast.error('Could not retry') });
  }
  repairFlow(): void {
    this.repairing.set(true);
    this.api.createRepairFlow(this.id()).subscribe({
      next: (r) => { this.repairing.set(false); if (r.flowId) { this.toast.success('Repair node added'); this.router.navigate(['/app/flows', r.flowId]); } else this.toast.warning('No active flow — create one first'); },
      error: () => { this.repairing.set(false); this.toast.error('Could not add repair node'); },
    });
  }
  back(): void { this.router.navigate(['/app/simulations']); }
}
