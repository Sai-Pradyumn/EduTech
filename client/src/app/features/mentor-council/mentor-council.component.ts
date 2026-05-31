import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { CouncilVerdict, MentorCouncilService } from '../../core/services/mentor-council.service';

@Component({
  selector: 'asta-mentor-council',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">AI Mentor Council</h1>
        <span class="goal-pill"><span class="dot"></span>Five agents debate your next move — the chair picks one</span>
      </div>
      <div class="flex gap-2.5 shrink-0"><asta-btn variant="ghost" size="sm" [loading]="loading()" (click)="reconvene()">Reconvene</asta-btn></div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="80px" /></asta-card>
      <div class="grid gap-3 sm:grid-cols-2 mt-4">@for (i of [1,2,3,4,5]; track i) { <asta-card><asta-skeleton h="90px" /></asta-card> }</div>
    } @else if (loadError() || !verdict()) {
      <asta-card><asta-empty-state title="Council unavailable" description=""><asta-btn variant="accent" (click)="convene()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (verdict()) {
      @if (verdict()!; as v) {
      <!-- chair verdict -->
      <asta-card class="block motion-card-reveal motion-row-primary verdict mb-4">
        <p class="kicker mb-1">The council's verdict</p>
        <div class="flex items-start gap-3">
          <span class="v-glyph">{{ v.chosen.glyph }}</span>
          <div class="min-w-0 flex-1">
            <p class="font-display text-lg leading-snug">{{ v.chosen.recommendation }}</p>
            <p class="text-sm text-txt-soft mt-1">{{ v.synthesis }}</p>
            <asta-btn variant="accent" size="sm" class="mt-3 inline-block" (click)="go(v.chosen.route)">Do this now <span class="arr">→</span></asta-btn>
          </div>
        </div>
      </asta-card>

      <p class="kicker mb-2">The debate</p>
      <div class="grid gap-3 sm:grid-cols-2 motion-row-2">
        @for (m of v.members; track m.agent; let i = $index) {
          <asta-card class="motion-card-reveal block" [class.is-chosen]="m.agent === v.chosen.agent" [style.--motion-card-index]="i % 2">
            <div class="flex items-center gap-2 mb-1">
              <span class="m-glyph">{{ m.glyph }}</span>
              <span class="m-agent">{{ m.agent }}</span>
              @if (m.agent === v.chosen.agent) { <span class="chosen-tag">chosen</span> }
              <span class="urgency" [title]="'urgency ' + m.urgency">{{ m.urgency }}</span>
            </div>
            <p class="m-stance">“{{ m.stance }}”</p>
            <p class="text-sm font-medium mt-1">{{ m.recommendation }}</p>
            <p class="text-xs text-txt-mute mt-0.5">{{ m.rationale }}</p>
            <button class="m-go" (click)="go(m.route)">Open →</button>
          </asta-card>
        }
      </div>
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .verdict { border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
      .v-glyph { font-size: 30px; }
      .m-glyph { font-size: 18px; }
      .m-agent { font-weight: 600; font-size: 14px; }
      .chosen-tag { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 2px 7px; border-radius: 999px; background: color-mix(in oklab, var(--green) 20%, transparent); color: var(--green-deep); }
      .urgency { margin-left: auto; font-size: 12px; color: var(--text-mute); font-variant-numeric: tabular-nums; }
      .m-stance { font-size: 13px; color: var(--peri, #8aa6ff); font-style: italic; }
      .is-chosen { box-shadow: 0 0 0 1px var(--green) inset; }
      .m-go { margin-top: 8px; font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--paper-3); background: transparent; color: var(--text-soft); cursor: pointer; }
      .m-go:hover { border-color: var(--green); color: var(--text); }
    `,
  ],
})
export class MentorCouncilComponent {
  private readonly api = inject(MentorCouncilService);
  private readonly router = inject(Router);
  readonly verdict = signal<CouncilVerdict | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  constructor() { this.convene(); }
  convene(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.convene().subscribe({ next: (v) => { this.verdict.set(v); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  reconvene(): void {
    this.loading.set(true);
    this.api.reconvene().subscribe({ next: (v) => { this.verdict.set(v); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  go(route: string): void { this.router.navigate([route]); }
}
