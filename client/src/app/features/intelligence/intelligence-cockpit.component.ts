import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IntelligenceService } from '../../core/services/intelligence.service';
import { LearningIntelligence } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { AiSkillRadarComponent, RadarAxis } from '../../shared/components/ai/ai-skill-radar.component';
import { LineChartComponent, ChartDatum } from '../../shared/charts';

@Component({
  selector: 'asta-intelligence-cockpit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent, CardComponent, RingComponent, SkeletonComponent, EmptyStateComponent, AiSkillRadarComponent, LineChartComponent],
  template: `
    <div class="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-[26px] mb-1">Learning Intelligence</h1>
        <p class="text-sm text-txt-mute">Your skill map, weak spots and readiness — from everything you do in Asta.</p>
      </div>
      <button class="text-xs text-txt-mute hover:text-txt" (click)="load()">Refresh</button>
    </div>

    @if (loading()) {
      <div class="grid gap-5 md:grid-cols-3">
        @for (i of [1,2,3]; track i) { <asta-card><asta-skeleton h="22px" w="55%" /><div class="mt-4"><asta-skeleton h="90px" /></div></asta-card> }
      </div>
    } @else if (error()) {
      <asta-card><div class="text-center py-8"><p class="text-txt-soft mb-4">Couldn’t load your intelligence.</p><asta-btn variant="ghost" size="sm" (click)="load()">Retry</asta-btn></div></asta-card>
    } @else {
      @if (data(); as d) {
      @if (!d.hasData) {
        <asta-card>
          <asta-empty-state title="Unlock your cockpit" description="Complete onboarding, then learn, quiz and follow your roadmap — your skill radar and readiness fill in as you go.">
            <asta-btn variant="accent" routerLink="/onboarding">Complete onboarding</asta-btn>
          </asta-empty-state>
        </asta-card>
      } @else {
        <!-- headline + scores -->
        <asta-card accentVar="var(--green)" class="block mb-5">
          <div class="flex flex-wrap items-center gap-6">
            <div class="flex items-center gap-5">
              <div class="text-center"><asta-ring [value]="d.healthScore" [size]="104" /><p class="kicker mt-2">Learning health</p></div>
              <div class="text-center"><asta-ring [value]="d.readinessScore" [size]="104" tone="peri" /><p class="kicker mt-2">Career readiness</p></div>
            </div>
            <p class="flex-1 min-w-[240px] text-[15px] text-txt-soft">{{ d.headline }}</p>
          </div>
        </asta-card>

        <div class="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-5">
          @for (s of d.scores; track s.label) {
            <asta-card>
              <p class="kicker mb-2">{{ s.label }}</p>
              <p class="font-display text-[26px] leading-none">{{ s.value }}<span class="text-base text-txt-mute">%</span></p>
              <div class="bar mt-2"><div class="bar-fill" [style.width.%]="s.value"></div></div>
              <p class="text-[11px] text-txt-mute mt-1.5">{{ s.hint }}</p>
            </asta-card>
          }
        </div>

        <div class="grid gap-5 lg:grid-cols-2 mb-5">
          <!-- radar -->
          <asta-card>
            <p class="kicker mb-3">Skill radar</p>
            @if (radarAxes().length >= 3) {
              <div class="grid place-items-center"><ai-skill-radar [data]="radarAxes()" /></div>
              <div class="flex items-center justify-center gap-4 mt-2 text-[11px] text-txt-mute">
                <span class="lg-dot" style="background:var(--green-deep)"></span> current
                <span class="lg-dot" style="background:var(--peri)"></span> target
              </div>
            } @else {
              <p class="text-sm text-txt-mute py-8 text-center">Add more skills (onboarding) and take quizzes to grow your radar.</p>
            }
            @if (d.strengths.length) {
              <div class="mt-3">
                <p class="text-[12px] text-txt-mute mb-1.5">Strengths</p>
                <div class="flex flex-wrap gap-1.5">@for (s of d.strengths; track s) { <span class="pill" style="color:var(--green-deep);border-color:var(--green)">{{ s }}</span> }</div>
              </div>
            }
          </asta-card>

          <!-- weakness heatmap -->
          <asta-card accentVar="var(--coral)">
            <p class="kicker mb-3" style="color:var(--coral-deep)">Weakness heatmap</p>
            @if (d.weaknesses.length) {
              <div class="space-y-2.5">
                @for (w of d.weaknesses; track w.topic) {
                  <div>
                    <div class="flex justify-between text-sm mb-1"><span>{{ w.topic }}</span><span class="font-mono text-xs text-txt-mute">{{ w.severity }}</span></div>
                    <div class="bar"><div class="bar-fill" [style.width.%]="w.severity" [style.background]="heat(w.severity)"></div></div>
                    <p class="text-[11px] text-txt-mute mt-0.5">{{ w.note }}</p>
                  </div>
                }
              </div>
              <asta-btn variant="ghost" size="sm" class="mt-3 inline-block" routerLink="/app/quizzes">Drill these in Quiz Studio →</asta-btn>
            } @else {
              <p class="text-sm text-txt-soft py-6 text-center">No weak spots flagged yet — take a quiz to map your gaps.</p>
            }
          </asta-card>
        </div>

        <div class="grid gap-5 lg:grid-cols-3 mb-5">
          <!-- momentum -->
          <asta-card>
            <p class="kicker mb-3">Momentum</p>
            <div class="grid grid-cols-2 gap-3">
              <div><p class="font-display text-2xl">{{ d.momentum.streak }}🔥</p><p class="text-xs text-txt-mute">day streak</p></div>
              <div><p class="font-display text-2xl">{{ d.momentum.activeDays }}</p><p class="text-xs text-txt-mute">active days /14</p></div>
              <div><p class="font-display text-2xl">{{ d.momentum.attempts }}</p><p class="text-xs text-txt-mute">quiz attempts</p></div>
              <div><p class="font-display text-2xl">{{ d.momentum.sessions }}</p><p class="text-xs text-txt-mute">AI sessions</p></div>
              <div><p class="font-display text-2xl">{{ d.momentum.projects }}</p><p class="text-xs text-txt-mute">projects</p></div>
            </div>
          </asta-card>

          <!-- trend -->
          <asta-card>
            <p class="kicker mb-3">Quiz trend</p>
            @if (trendData().length >= 2) {
              <asta-line-chart [area]="true" tone="green" [data]="trendData()" [height]="92"
                [format]="pctFmt" label="Recent quiz scores" />
              <p class="text-[11px] text-txt-mute mt-1.5 text-center">most recent {{ d.trend.length }} attempt(s)</p>
            } @else if (d.trend.length === 1) {
              <p class="font-display text-3xl text-center py-6">{{ d.trend[0].score }}%<span class="block text-[11px] font-sans text-txt-mute">one attempt so far</span></p>
            } @else {
              <p class="text-sm text-txt-mute py-6 text-center">No attempts yet.</p>
            }
          </asta-card>

          <!-- recommendations -->
          <asta-card accentVar="var(--peri)">
            <p class="kicker mb-3" style="color:var(--peri-deep)">Recommended next</p>
            <ul class="space-y-2 text-sm text-txt-soft">
              @for (r of d.recommendations; track r) { <li class="flex gap-2"><span style="color:var(--peri-deep)">→</span>{{ r }}</li> }
            </ul>
          </asta-card>
        </div>

        <!-- timeline -->
        <asta-card>
          <p class="kicker mb-3">Recent activity</p>
          @if (d.timeline.length) {
            <ol class="space-y-2.5">
              @for (t of d.timeline; track $index) {
                <li class="flex items-center gap-3 text-sm">
                  <span class="tl-dot" [style.background]="tlColor(t.kind)"></span>
                  <span class="flex-1">{{ t.label }} @if (t.detail) { <span class="text-txt-mute">· {{ t.detail }}</span> }</span>
                  <span class="text-[11px] text-txt-mute font-mono">{{ ago(t.at) }}</span>
                </li>
              }
            </ol>
          } @else {
            <p class="text-sm text-txt-mute py-4 text-center">Your learning activity will appear here.</p>
          }
        </asta-card>
      }
      }
    }
  `,
  styles: [
    `
      .bar { height: 6px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 100px; background: var(--green); transition: width .8s var(--ease); }
      .lg-dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
      .tl-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    `,
  ],
})
export class IntelligenceCockpitComponent {
  private readonly intel = inject(IntelligenceService);

  readonly data = signal<LearningIntelligence | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly radarAxes = computed<RadarAxis[]>(() =>
    (this.data()?.radar ?? []).map((a) => ({ label: a.label, value: a.value, target: a.target })),
  );

  /** Recent quiz scores → line chart points. */
  readonly trendData = computed<ChartDatum[]>(() =>
    (this.data()?.trend ?? []).map((t, i) => ({ label: '#' + (i + 1), value: t.score })),
  );
  readonly pctFmt = (v: number): string => `${Math.round(v)}%`;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.intel.overview().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  heat(sev: number): string {
    return sev >= 70 ? 'var(--coral)' : sev >= 50 ? 'oklch(0.78 0.16 38)' : 'var(--peri)';
  }
  tlColor(kind: string): string {
    return kind === 'quiz' ? 'var(--green)' : kind === 'chat' ? 'var(--peri)' : 'var(--coral)';
  }
  ago(iso: string): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
}
