import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { CouncilAction, CouncilResult, OutcomeCouncilService } from '../../core/services/outcome-council.service';

@Component({
    selector: 'asta-outcome-council',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">AI Outcome Council</h1>
        <span class="goal-pill"><span class="dot"></span>Six specialist mentors debate your single best next move</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        @if (result()) { <asta-btn variant="ghost" size="sm" (click)="copyVerdict()">Copy verdict</asta-btn> }
        <asta-btn variant="accent" size="sm" (click)="convene()" [disabled]="busy()">{{ busy() ? 'Convening…' : 'Convene council' }}</asta-btn>
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="140px" /></asta-card>
      <div class="grid gap-3 sm:grid-cols-3 mt-3">@for (i of [1,2,3]; track i) { <asta-card><asta-skeleton h="120px" /></asta-card> }</div>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not reach the council" description=""><asta-btn variant="accent" (click)="convene()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (!result()) {
      <asta-card><asta-empty-state title="The council hasn't met yet" description="Convene the council and Asta's specialist agents will debate your data and agree on the highest-impact next action.">
        <asta-btn variant="accent" (click)="convene()">Convene council</asta-btn>
      </asta-empty-state></asta-card>
    } @else if (result()) {
      @if (result(); as r) {
      <!-- verdict + best action -->
      @if (r.best && !dismissed().has(r.best.id)) {
      @if (r.best; as b) {
        <asta-card class="block motion-card-reveal motion-row-primary mb-4 verdict">
          <div class="flex items-start gap-4 flex-wrap">
            <div class="text-center shrink-0"><asta-ring [value]="b.expectedImpact" [size]="84" /><p class="g-lbl">Impact</p></div>
            <div class="min-w-0 flex-1">
              <p class="kicker mb-1">Council verdict · {{ r.context.role }} · {{ r.context.readinessScore }}% ready</p>
              <h2 class="best-action">{{ b.action }}</h2>
              @if (b.why) { <p class="best-why">{{ b.why }}</p> }
              <p class="verdict-text">{{ r.verdict }}</p>
              <div class="flex flex-wrap items-center gap-2 mt-3">
                <span class="meta-chip">⏱ {{ b.timeRequired }}</span>
                <span class="meta-chip">proposed by {{ b.agent }}</span>
                <asta-btn variant="accent" size="sm" (click)="accept(b)">Do this now →</asta-btn>
                <asta-btn variant="ghost" size="sm" (click)="dismiss(b.id)">Dismiss</asta-btn>
              </div>
            </div>
          </div>
        </asta-card>
      }
      }

      <!-- alternatives -->
      @if (visibleAlternatives(r).length) {
        <p class="kicker mb-3">Alternatives the council considered</p>
        <div class="grid gap-3 md:grid-cols-3 motion-row-2">
          @for (alt of visibleAlternatives(r); track alt.id) {
            <asta-card class="block alt motion-card-reveal" [style.--motion-card-index]="$index">
              <div class="flex items-center justify-between mb-1.5">
                <span class="alt-agent">{{ alt.agent }}</span>
                <span class="alt-impact">{{ alt.expectedImpact }}</span>
              </div>
              <p class="alt-action">{{ alt.action }}</p>
              <p class="alt-why">{{ alt.why }}</p>
              <p class="alt-risk"><span class="risk-tag">Risk</span> {{ alt.riskIfIgnored }}</p>
              <div class="flex gap-2 mt-2">
                <asta-btn variant="ghost" size="sm" (click)="accept(alt)">Open</asta-btn>
                <button class="dismiss" (click)="dismiss(alt.id)">Dismiss</button>
              </div>
            </asta-card>
          }
        </div>
      }
      <p class="text-[11px] text-txt-mute mt-4">Last convened {{ when(r.generatedAt) }}.</p>
      }
    }
  `,
    styles: [`
    :host { display: block; }
    /* The ranked verdict carries the room — accent ring + glow; the action rises in. */
    .verdict { border: 1px solid color-mix(in oklab, var(--green) 24%, var(--paper-3)); box-shadow: 0 0 24px var(--asta-accent-glow); }
    .g-lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; text-align: center; }
    .best-action { font-size: 19px; font-weight: 700; line-height: 1.2; animation: astaRevealUp .5s var(--ease) .15s both; }
    @media (prefers-reduced-motion: reduce) { .best-action { animation: none; } }
    .best-why { font-size: 12.5px; color: var(--text-soft); margin-top: 4px; line-height: 1.5; }
    .verdict-text { font-size: 13.5px; color: var(--text-soft); margin-top: 6px; line-height: 1.55; }
    .meta-chip { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: var(--paper-2); border: 1px solid var(--paper-3); color: var(--text-mute); }
    .alt { display: flex; flex-direction: column; }
    .alt-agent { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--peri, #8aa6ff); }
    .alt-impact { font-size: 13px; font-weight: 700; color: var(--green-deep); font-variant-numeric: tabular-nums; }
    .alt-action { font-size: 13.5px; font-weight: 600; }
    .alt-why { font-size: 12px; color: var(--text-soft); margin-top: 3px; }
    .alt-risk { font-size: 11.5px; color: var(--text-mute); margin-top: 6px; }
    .risk-tag { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--coral, #ffb454); margin-right: 5px; }
    .dismiss { font-size: 12px; color: var(--text-mute); background: transparent; border: none; cursor: pointer; }
    .dismiss:hover { color: var(--text); }
  `]
})
export class OutcomeCouncilComponent {
  private readonly api = inject(OutcomeCouncilService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly result = signal<CouncilResult | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal(false);
  readonly dismissed = signal<Set<string>>(new Set());

  constructor() {
    this.api.latest().subscribe({
      next: (r) => { this.result.set(r); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  convene(): void {
    this.busy.set(true);
    this.api.recommend().subscribe({
      next: (r) => { this.result.set(r); this.dismissed.set(new Set()); this.busy.set(false); this.loading.set(false); this.toast.success('The council has spoken'); },
      error: () => { this.busy.set(false); this.toast.error('Council failed to convene'); },
    });
  }

  visibleAlternatives(r: CouncilResult): CouncilAction[] {
    return r.alternatives.filter((a) => !this.dismissed().has(a.id));
  }

  accept(a: CouncilAction): void {
    this.router.navigate([a.route]);
  }

  dismiss(id: string): void {
    const next = new Set(this.dismissed());
    next.add(id);
    this.dismissed.set(next);
  }

  copyVerdict(): void {
    const r = this.result();
    if (!r) return;
    const lines: string[] = [];
    lines.push(`# AI Outcome Council verdict`);
    lines.push(`\n_${r.context.role} · ${r.context.readinessScore}% ready · convened ${this.when(r.generatedAt)}_\n`);
    if (r.best) {
      lines.push(`## ✓ Best next move: ${r.best.action}`);
      if (r.best.why) lines.push(`- Why: ${r.best.why}`);
      lines.push(`- Expected impact: ${r.best.expectedImpact} · ⏱ ${r.best.timeRequired} · proposed by ${r.best.agent}`);
    }
    lines.push(`\n${r.verdict}\n`);
    if (r.alternatives.length) {
      lines.push('## Alternatives considered');
      for (const a of r.alternatives) {
        lines.push(`### ${a.action} (${a.agent} · impact ${a.expectedImpact})`);
        lines.push(`- Why: ${a.why}`);
        lines.push(`- Risk if ignored: ${a.riskIfIgnored}`);
      }
    }
    const md = lines.join('\n');
    navigator.clipboard?.writeText(md).then(
      () => this.toast.success('Council verdict copied as Markdown'),
      () => this.toast.error('Copy failed'),
    );
  }

  when(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}
