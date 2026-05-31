import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { MODALITY_META, SkillTwin, SkillTwinService, TwinAction } from '../../core/services/skill-twin.service';

@Component({
  selector: 'asta-skill-twin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Skill Twin</h1>
        <span class="goal-pill"><span class="dot"></span>Your living learner model · explainable next moves</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn>
        @if (twin()) {
          <asta-btn variant="ghost" size="sm" (click)="resetMemory()">{{ armed() ? 'Confirm reset?' : 'Reset memory' }}</asta-btn>
        }
      </div>
    </header>

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-4 mb-4">@for (i of [1,2,3,4]; track i) { <asta-card><asta-skeleton h="90px" /></asta-card> }</div>
      <asta-card><asta-skeleton h="220px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load your Skill Twin" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (twin()) {
      @if (twin()!; as t) {
      @if (!t.hasData) {
        <asta-card class="block"><asta-empty-state title="Your Skill Twin is warming up" description="Take a quiz, advance a flow, or chat with the tutor — Asta will start modelling your mastery, weaknesses and pace here.">
          <asta-btn variant="accent" (click)="go('/app/quizzes')">Take a quiz</asta-btn>
        </asta-empty-state></asta-card>
      } @else {
        <p class="headline motion-card-reveal motion-row-primary">{{ t.headline }}</p>

        <!-- gauges -->
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 motion-row-2 mb-4">
          <asta-card class="gauge motion-card-reveal" [style.--motion-card-index]="0">
            <asta-ring [value]="t.readinessScore" [size]="78" /><p class="g-lbl">Readiness</p>
          </asta-card>
          <asta-card class="gauge motion-card-reveal" [style.--motion-card-index]="1">
            <asta-ring [value]="t.healthScore" [size]="78" /><p class="g-lbl">Health</p>
          </asta-card>
          <asta-card class="gauge col motion-card-reveal" [style.--motion-card-index]="2">
            <p class="risk-num" [style.color]="riskColor(t.retentionRisk)">{{ t.retentionRisk }}</p>
            <p class="g-lbl">Retention risk</p>
            <div class="risk-track"><span class="risk-fill" [style.width.%]="t.retentionRisk" [style.background]="riskColor(t.retentionRisk)"></span></div>
          </asta-card>
          <asta-card class="gauge col motion-card-reveal" [style.--motion-card-index]="3">
            <p class="risk-num" [style.color]="riskColor(t.burnoutRisk)">{{ t.burnoutRisk }}</p>
            <p class="g-lbl">Burnout risk</p>
            <div class="risk-track"><span class="risk-fill" [style.width.%]="t.burnoutRisk" [style.background]="riskColor(t.burnoutRisk)"></span></div>
          </asta-card>
        </div>

        <div class="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
          <div class="min-w-0 space-y-4">
            <!-- next best actions w/ explainability -->
            <asta-card class="block motion-card-reveal motion-row-3">
              <p class="kicker mb-3">Next best actions · why Asta recommends them</p>
              <div class="space-y-2">
                @for (a of t.nextBestActions; track a.id) {
                  <div class="action">
                    <div class="flex items-center gap-2.5">
                      <span class="mod-glyph" [title]="modalityLabel(a.modality)">{{ modalityGlyph(a.modality) }}</span>
                      <span class="min-w-0 flex-1">
                        <span class="a-label">{{ a.label }}</span>
                        <span class="a-mod">{{ modalityLabel(a.modality) }}</span>
                      </span>
                      <button class="why-btn" (click)="toggleWhy(a.id)">{{ openWhy() === a.id ? 'Hide why' : 'Why?' }}</button>
                      <asta-btn size="sm" variant="accent" (click)="go(a.route)">Start</asta-btn>
                    </div>
                    @if (openWhy() === a.id) {
                      <div class="why-drawer"><span class="why-tag">Because</span> {{ a.reason }}</div>
                    }
                  </div>
                }
              </div>
            </asta-card>

            <!-- mastery graph -->
            <asta-card class="block motion-card-reveal motion-row-3">
              <p class="kicker mb-3">Mastery graph</p>
              <div class="space-y-2">
                @for (s of t.skills; track s.skill) {
                  <div class="skill-row">
                    <span class="s-label" [title]="s.skill">{{ s.skill }}</span>
                    <span class="s-track">
                      <span class="s-fill" [style.width.%]="s.mastery"></span>
                      <span class="s-target" [style.left.%]="s.target" [title]="'target ' + s.target"></span>
                    </span>
                    <span class="s-val">{{ s.mastery }}</span>
                  </div>
                }
              </div>
            </asta-card>

            <!-- weakness roots -->
            @if (t.weaknessRoots.length) {
              <asta-card class="block motion-card-reveal motion-row-3">
                <div class="flex items-center justify-between mb-3">
                  <p class="kicker !mb-0">Weakness roots</p>
                  <asta-btn variant="ghost" size="sm" (click)="go('/app/mistakes')">Open Mistake OS →</asta-btn>
                </div>
                <div class="space-y-1.5">
                  @for (w of t.weaknessRoots; track w.concept) {
                    <div class="wr-row">
                      <span class="wr-dot" [style.background]="riskColor(w.severity)"></span>
                      <span class="wr-concept">{{ w.concept }}</span>
                      <span class="wr-meta">{{ w.status }} · sev {{ w.severity }} · ×{{ w.frequency }}</span>
                    </div>
                  }
                </div>
              </asta-card>
            }
          </div>

          <!-- right rail: modality + memory + signals + strengths -->
          <div class="space-y-4">
            <asta-card class="block motion-card-reveal motion-row-2 modality">
              <p class="kicker mb-1">Recommended modality</p>
              <p class="mod-pick">{{ modalityGlyph(t.modality.modality) }} {{ modalityLabel(t.modality.modality) }}</p>
              <p class="text-sm text-txt-soft mt-1">{{ t.modality.reason }}</p>
              <p class="text-[11px] text-txt-mute mt-2">Pace: <b>{{ t.pace }}</b>@if (t.projectedDaysToGoal !== null) { · ~{{ t.projectedDaysToGoal }}d to goal }</p>
            </asta-card>

            @if (t.misconceptionMemory.length) {
              <asta-card class="block motion-card-reveal motion-row-3">
                <p class="kicker mb-2">Misconception memory</p>
                <div class="flex flex-wrap gap-1.5">
                  @for (m of t.misconceptionMemory; track m.concept) {
                    <span class="mem-chip">{{ m.concept }} <em>×{{ m.frequency }}</em></span>
                  }
                </div>
              </asta-card>
            }

            @if (t.strengths.length) {
              <asta-card class="block motion-card-reveal motion-row-3">
                <p class="kicker mb-2">Strengths</p>
                <div class="flex flex-wrap gap-1.5">
                  @for (s of t.strengths; track s) { <span class="str-chip">{{ s }}</span> }
                </div>
              </asta-card>
            }

            <asta-card class="block motion-card-reveal motion-row-3">
              <p class="kicker mb-2">Signals feeding your twin</p>
              <ul class="text-sm text-txt-soft space-y-1">
                @for (sig of t.signals; track sig.label) {
                  <li><span class="text-txt-mute">{{ sig.label }}:</span> {{ sig.detail }}</li>
                }
              </ul>
            </asta-card>
          </div>
        </div>
      }
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .headline { font-size: 15px; color: var(--text-soft); margin-bottom: 16px; }
      .gauge { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; }
      .gauge.col { gap: 4px; }
      .g-lbl { font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; }
      .risk-num { font-size: 30px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
      .risk-track { width: 80%; height: 6px; border-radius: 999px; background: var(--paper-3); overflow: hidden; margin-top: 4px; }
      .risk-fill { display: block; height: 100%; border-radius: 999px; }
      .action { padding: 10px 12px; border: 1px solid var(--paper-3); border-radius: 12px; background: var(--paper-2); }
      .mod-glyph { font-size: 18px; flex-shrink: 0; }
      .a-label { display: block; font-size: 13.5px; font-weight: 600; }
      .a-mod { display: block; font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
      .why-btn { font-size: 11px; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--paper-3); background: transparent; color: var(--peri, #8aa6ff); cursor: pointer; white-space: nowrap; }
      .why-btn:hover { border-color: var(--peri, #8aa6ff); }
      .why-drawer { margin-top: 8px; padding: 9px 11px; border-radius: 10px; background: color-mix(in oklab, var(--peri, #8aa6ff) 10%, transparent); border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 30%, transparent); font-size: 13px; color: var(--text-soft); }
      .why-tag { color: var(--peri, #8aa6ff); font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; margin-right: 6px; }
      .skill-row { display: grid; grid-template-columns: 130px 1fr auto; align-items: center; gap: 10px; }
      .s-label { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .s-track { position: relative; height: 8px; border-radius: 999px; background: var(--paper-3); overflow: visible; }
      .s-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--green-deep), var(--green)); }
      .s-target { position: absolute; top: -2px; width: 2px; height: 12px; background: var(--peri, #8aa6ff); }
      .s-val { font-size: 11px; color: var(--text-mute); font-variant-numeric: tabular-nums; }
      .wr-row { display: flex; align-items: center; gap: 9px; font-size: 13px; }
      .wr-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .wr-concept { font-weight: 500; }
      .wr-meta { margin-left: auto; font-size: 11px; color: var(--text-mute); }
      .modality { border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 30%, var(--paper-3)); }
      .mod-pick { font-size: 18px; font-weight: 700; }
      .mem-chip { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--coral, #ffb454) 35%, var(--paper-3)); }
      .mem-chip em { color: var(--text-mute); font-style: normal; }
      .str-chip { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); }
    `,
  ],
})
export class SkillTwinComponent {
  private readonly api = inject(SkillTwinService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly twin = signal<SkillTwin | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly openWhy = signal<string | null>(null);
  readonly armed = signal(false);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.get().subscribe({
      next: (t) => { this.twin.set(t); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  toggleWhy(id: string): void { this.openWhy.set(this.openWhy() === id ? null : id); }
  go(route: string): void { this.router.navigate([route]); }

  modalityGlyph(m: TwinAction['modality']): string { return MODALITY_META[m].glyph; }
  modalityLabel(m: TwinAction['modality']): string { return MODALITY_META[m].label; }
  riskColor(v: number): string {
    return v >= 66 ? 'var(--danger, #ff5d5d)' : v >= 40 ? 'var(--coral, #ffb454)' : 'var(--green)';
  }

  resetMemory(): void {
    if (!this.armed()) { this.armed.set(true); setTimeout(() => this.armed.set(false), 4000); return; }
    this.armed.set(false);
    this.api.reset().subscribe({
      next: (r) => { this.toast.success(`Learning memory cleared (${r.clearedMistakes} mistakes)`); this.refresh(); },
      error: () => this.toast.error('Could not reset memory'),
    });
  }
}
