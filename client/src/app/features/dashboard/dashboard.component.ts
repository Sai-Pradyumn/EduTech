import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RoadmapService } from '../../core/services/roadmap.service';
import { StudentProfileService } from '../../core/services/student-profile.service';
import { IntelligenceService } from '../../core/services/intelligence.service';
import { AgentService } from '../../core/services/agent.service';
import { LearningIntelligence, NextAction, Roadmap, RoadmapWeek, StudentProfile } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { ProgressComponent } from '../../shared/ui/progress.component';
import { AstaLearningRiverComponent, RiverNode } from '../../shared/ui/synapse';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { CountDirective } from '../../shared/directives/count.directive';
import { ConfettiService } from '../../core/services/confetti.service';

/**
 * Dashboard — compact Noir cockpit. Command header → active-roadmap + progress
 * grid → learning-intelligence strip → three compact intelligence panels →
 * learning river (lower). Data-dense and useful above the fold; NO marketing hero.
 */
@Component({
  selector: 'asta-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent,
    RingComponent, ProgressComponent, AstaLearningRiverComponent, MagneticDirective, CountDirective,
  ],
  template: `
    @if (loading()) {
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <asta-skeleton h="34px" w="240px" />
        <asta-skeleton h="40px" w="180px" />
      </div>
      <div class="grid gap-5 lg:grid-cols-3">
        <asta-skeleton h="280px" class="lg:col-span-2" />
        <asta-skeleton h="280px" />
      </div>

    } @else if (error()) {
      <asta-card>
        <div class="text-center py-8">
          <p class="text-txt-soft mb-4">Couldn’t load your dashboard.</p>
          <asta-btn variant="ghost" size="sm" (click)="load()">Retry</asta-btn>
        </div>
      </asta-card>

    } @else if (!profile()) {
      <asta-card>
        <asta-empty-state title="Welcome to Asta" description="Tell us your goal and how you learn, and Asta will map your path.">
          <asta-btn variant="accent" routerLink="/onboarding">Complete onboarding</asta-btn>
        </asta-empty-state>
      </asta-card>

    } @else if (!roadmap()) {
      <asta-card>
        <asta-empty-state title="Let’s build your roadmap" description="Asta can create a focused, week-by-week path from your target role and daily time.">
          <div class="flex gap-3">
            <asta-btn variant="accent" routerLink="/app/roadmap/generate">Generate roadmap</asta-btn>
            <asta-btn variant="ghost" routerLink="/app/tutor">Ask the tutor</asta-btn>
          </div>
        </asta-empty-state>
      </asta-card>

    } @else {
      @if (roadmap(); as r) {
      <!-- Compact command header -->
      <header class="asta-page-command-header">
        <div class="min-w-0">
          <h1 class="text-[28px] leading-tight mb-2 grad-flow">{{ greeting() }}, {{ firstName() }}</h1>
          <span class="goal-pill"><span class="dot"></span>{{ profile()!.mainGoal }}</span>
        </div>
        <div class="flex flex-wrap gap-2.5 shrink-0">
          <asta-btn variant="accent" astaMagnetic [routerLink]="['/app/roadmap', r.id]">Continue learning</asta-btn>
          <asta-btn variant="ghost" astaMagnetic routerLink="/app/tutor">Ask Asta</asta-btn>
        </div>
      </header>

      <!-- Proactive "Your next move" — the system decides what's next from your state -->
      @if (nextMove(); as nm) {
        <asta-card class="mb-5 next-move dashboard-primary-card dashboard-reveal" style="--motion-card-index:0">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="min-w-0">
              <p class="kicker mb-1">Your next move</p>
              <h3 class="t-h-card mb-0.5">{{ nm.label }}</h3>
              <p class="text-sm text-txt-soft">{{ nm.reason }}</p>
            </div>
            <asta-btn variant="accent" astaMagnetic (click)="goNext(nm)">Let’s go <span class="arr">→</span></asta-btn>
          </div>
        </asta-card>
      }

      <!-- Active roadmap (anchor) + progress — same row, same reveal family -->
      <div class="grid gap-5 lg:grid-cols-3 motion-row-primary">
        <asta-card class="lg:col-span-2 dashboard-primary-card dashboard-reveal" style="--motion-card-index:0">
          <p class="kicker mb-3">Active roadmap</p>
          <h2 class="t-h-card mb-1">{{ r.title }}</h2>
          <p class="text-sm text-txt-soft mb-4">{{ r.estimatedDuration }}</p>
          <div class="flex items-center gap-3 mb-5">
            <div class="flex-1"><asta-progress [value]="r.progressPercentage" /></div>
            <span class="font-mono text-sm text-txt-soft"><span [astaCount]="r.progressPercentage" suffix="%"></span></span>
          </div>
          @if (currentWeek(); as w) {
            <div class="cur-week">
              <div class="flex items-center justify-between gap-3 mb-2">
                <p class="font-mono text-[11px] uppercase tracking-wider text-txt-mute">Current — Week {{ w.weekNumber }}</p>
                <button class="mark-cur" [disabled]="busy()" (click)="toggleWeek(currentWeekIndex())">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Mark complete
                </button>
              </div>
              <p class="font-semibold mb-2.5">{{ w.focus }}</p>
              <ul class="space-y-1.5">
                @for (t of w.tasks.slice(0, 4); track t) { <li class="task"><span class="task-dot"></span><span class="min-w-0">{{ t }}</span></li> }
              </ul>
            </div>
          }
          <div class="mt-4"><asta-btn variant="accent" size="sm" [routerLink]="['/app/roadmap', r.id]">Open full roadmap <span class="arr">→</span></asta-btn></div>
        </asta-card>

        <asta-card class="dashboard-primary-card dashboard-reveal" style="--motion-card-index:1">
          <p class="kicker mb-3">Progress</p>
          <div class="flex items-center gap-4">
            <asta-ring [value]="r.progressPercentage" [size]="92" />
            <div class="text-sm text-txt-soft space-y-1">
              <p><span class="font-semibold text-txt" [astaCount]="r.completedWeeks.length"></span>/{{ r.weeklyPlan.length }} weeks</p>
              <p><span class="font-semibold text-txt" [astaCount]="milestonesReached()"></span>/{{ r.milestones.length }} milestones</p>
              @if (intel(); as li) { <p><span class="font-semibold text-txt" [astaCount]="li.momentum.streak"></span>-day streak</p> }
            </div>
          </div>
        </asta-card>
      </div>

      <!-- Learning intelligence strip (compact, horizontal) -->
      @if (intel(); as li) {
        <a routerLink="/app/progress" class="card hover-lift block mt-5 motion-strip dashboard-reveal" style="padding:16px 18px;text-decoration:none;--motion-card-index:0">
          <div class="flex flex-wrap items-center gap-5">
            <div class="text-center"><asta-ring [value]="li.healthScore" [size]="60" /><p class="text-[11px] text-txt-mute mt-1">Health</p></div>
            <div class="text-center"><asta-ring [value]="li.readinessScore" [size]="60" tone="peri" /><p class="text-[11px] text-txt-mute mt-1">Readiness</p></div>
            <div class="flex-1 min-w-[220px]">
              <p class="kicker mb-1">Learning intelligence</p>
              <p class="text-sm text-txt-soft">{{ li.headline }}</p>
              @if (topRecommendation()) { <p class="text-[13px] text-txt-mute mt-1">{{ topRecommendation() }}</p> }
            </div>
            <span class="text-sm font-semibold shrink-0" style="color:var(--green-deep)">Open cockpit <span class="arr">→</span></span>
          </div>
        </a>
      }

      <!-- Three compact intelligence panels — same row, same reveal + hover family -->
      <div class="grid gap-5 md:grid-cols-3 mt-5 motion-row-panel">
        <asta-card class="dashboard-panel-card dashboard-reveal" style="--motion-card-index:0" [interactive]="true" [routerLink]="['/app/roadmap', r.id]">
          <div class="panel-head">
            <p class="kicker" style="color:var(--peri-deep)">Next milestone</p>
            <span class="panel-ico peri" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </span>
          </div>
          @if (nextMilestone(); as m) {
            <p class="font-semibold mb-1 mt-2">{{ m.title }}</p>
            <p class="text-sm text-txt-soft">Target: week {{ m.targetWeek }}</p>
          } @else { <p class="text-sm text-txt-soft mt-2">All milestones reached 🎉</p> }
        </asta-card>

        <asta-card class="dashboard-panel-card dashboard-reveal" style="--motion-card-index:1" [interactive]="true" routerLink="/app/quizzes">
          <div class="panel-head">
            <p class="kicker" style="color:var(--coral-deep)">Weak areas</p>
            <span class="panel-ico coral" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </span>
          </div>
          @if (profile()!.weakAreas.length) {
            <div class="flex flex-wrap gap-1.5 mt-2 motion-stagger">
              @for (w of profile()!.weakAreas; track w) { <span class="weak-chip">{{ w }}</span> }
            </div>
          } @else { <p class="text-sm text-txt-soft mt-2">None flagged — keep it up.</p> }
        </asta-card>

        <asta-card class="dashboard-panel-card dashboard-reveal" style="--motion-card-index:2" [interactive]="true" routerLink="/app/projects">
          <div class="panel-head">
            <p class="kicker">Recommended project</p>
            <span class="panel-ico green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>
            </span>
          </div>
          @if (r.recommendedProjects[0]; as proj) {
            <p class="font-semibold mb-1 mt-2">{{ proj.title }}</p>
            <p class="text-sm text-txt-soft line-clamp-2">{{ proj.description }}</p>
          } @else { <p class="text-sm text-txt-soft mt-2">Generate a project from your roadmap.</p> }
        </asta-card>
      </div>

      <!-- Learning river (lower section — path overview, not a hero) -->
      <asta-card class="block mt-5 motion-lower dashboard-reveal" style="--motion-card-index:0">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="kicker mb-1">Learning river</p>
            <h2 class="t-h-card">Your path to {{ r.title }}</h2>
          </div>
          <asta-btn variant="ghost" size="sm" [routerLink]="['/app/roadmap', r.id]">View full roadmap <span class="arr">→</span></asta-btn>
        </div>
        <div class="mt-2">
          <asta-learning-river [nodes]="riverNodes()" (select)="goToRoadmap()" />
        </div>
      </asta-card>
      }
    }
  `,
  styles: [
    `
      .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .panel-ico {
        width: 34px; height: 34px; flex-shrink: 0;
        display: grid; place-items: center;
        border-radius: 11px;
        color: var(--green-deep);
        background: color-mix(in oklch, var(--green) 13%, transparent);
        transition: transform 0.4s var(--ease-spring);
      }
      .panel-ico.peri { color: var(--peri-deep); background: color-mix(in oklch, var(--peri) 15%, transparent); }
      .panel-ico.coral { color: var(--coral-deep); background: color-mix(in oklch, var(--coral) 15%, transparent); }
      /* host hover (the asta-card element is in this view's scope) animates the glyph */
      asta-card:hover .panel-ico { transform: scale(1.14) rotate(-8deg); }

      .weak-chip {
        font-family: var(--mono); font-size: 12px;
        padding: 6px 11px; border-radius: 999px;
        color: var(--coral-deep);
        background: color-mix(in oklch, var(--coral) 13%, transparent);
        transition: transform 0.18s var(--ease-spring), background 0.18s var(--ease);
      }
      .weak-chip:hover { transform: translateY(-2px) scale(1.06); background: color-mix(in oklch, var(--coral) 22%, transparent); }

      /* Compact current-week box (dashboard) — the full week tracker lives on the roadmap page. */
      .cur-week {
        border-radius: 14px;
        padding: 14px 16px;
        background: color-mix(in oklch, var(--paper-2) 60%, transparent);
        border: 1px solid color-mix(in oklch, var(--paper-3) 50%, transparent);
      }
      .task { display: grid; grid-template-columns: 16px 1fr; gap: 10px; align-items: start; font-size: 14px; color: var(--text-soft); }
      .task-dot { width: 6px; height: 6px; margin-top: 7px; border-radius: 999px; background: var(--green-deep); box-shadow: 0 0 0 3px color-mix(in oklch, var(--green) 16%, transparent); }
      .mark-cur {
        display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
        font-family: var(--body); font-size: 12px; font-weight: 600;
        padding: 5px 11px; border-radius: 999px; cursor: pointer;
        color: var(--green-deep);
        background: color-mix(in oklch, var(--green) 12%, transparent);
        border: 1px solid color-mix(in oklch, var(--green) 30%, transparent);
        transition: transform 0.12s var(--ease-spring), background 0.18s var(--ease);
      }
      .mark-cur:hover { background: color-mix(in oklch, var(--green) 22%, transparent); }
      .mark-cur:active { transform: scale(0.96); }
      .mark-cur:disabled { opacity: 0.5; cursor: default; }
    `,
  ],
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(StudentProfileService);
  private readonly roadmaps = inject(RoadmapService);
  private readonly intelligence = inject(IntelligenceService);
  private readonly agent = inject(AgentService);
  private readonly router = inject(Router);
  private readonly confetti = inject(ConfettiService);

  readonly profile = signal<StudentProfile | null>(null);
  readonly roadmap = signal<Roadmap | null>(null);
  readonly intel = signal<LearningIntelligence | null>(null);
  readonly nextMove = signal<NextAction | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly firstName = computed(() => this.auth.user()?.name?.split(' ')[0] ?? 'there');
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });

  readonly currentWeek = computed<RoadmapWeek | null>(() => {
    const r = this.roadmap();
    if (!r) return null;
    return r.weeklyPlan.find((w) => !r.completedWeeks.includes(w.weekNumber)) ?? r.weeklyPlan[r.weeklyPlan.length - 1] ?? null;
  });

  readonly milestonesReached = computed(() => {
    const r = this.roadmap();
    if (!r) return 0;
    return r.milestones.filter((m) => m.targetWeek <= r.completedWeeks.length).length;
  });

  readonly nextMilestone = computed(() => {
    const r = this.roadmap();
    if (!r) return null;
    return r.milestones.find((m) => m.targetWeek > r.completedWeeks.length) ?? null;
  });

  readonly topRecommendation = computed(() => this.intel()?.recommendations?.[0] ?? '');
  readonly busy = signal(false);

  /** Index of the current week within the plan (for the compact mark-complete). */
  readonly currentWeekIndex = computed(() => {
    const r = this.roadmap();
    const w = this.currentWeek();
    if (!r || !w) return -1;
    return r.weeklyPlan.findIndex((x) => x.weekNumber === w.weekNumber);
  });

  /** Explicit mark-complete (NOT scroll-driven) — persists week progress. */
  toggleWeek(i: number): void {
    const r = this.roadmap();
    if (!r || this.busy()) return;
    const w = r.weeklyPlan[i];
    if (!w) return;
    const completed = r.completedWeeks.includes(w.weekNumber);
    this.busy.set(true);
    this.roadmaps.updateProgress(r.id, { weekNumber: w.weekNumber, weekCompleted: !completed }).subscribe({
      next: (updated) => {
        this.roadmap.set(updated);
        this.busy.set(false);
        // Celebrate completing a week (not un-completing).
        if (!completed) this.confetti.burst({ y: 0.42 });
        this.intelligence.overview().subscribe({ next: (d) => this.intel.set(d), error: () => undefined });
      },
      error: () => this.busy.set(false),
    });
  }

  /** Roadmap milestones (or sampled weeks) as a compact flowing learning river. */
  readonly riverNodes = computed<RiverNode[]>(() => {
    const r = this.roadmap();
    if (!r) return [];
    const done = r.completedWeeks.length;
    if (r.milestones?.length) {
      const nextIdx = r.milestones.findIndex((m) => m.targetWeek > done);
      return r.milestones.slice(0, 6).map((m, i) => ({
        label: m.title,
        hint: `Week ${m.targetWeek}`,
        state: m.targetWeek <= done ? 'completed' : i === nextIdx ? 'active' : 'upcoming',
      }));
    }
    const weeks = r.weeklyPlan;
    const curNo = this.currentWeek()?.weekNumber ?? 1;
    const idxs = Array.from(new Set([0, curNo - 2, curNo - 1, curNo, weeks.length - 1]))
      .filter((i) => i >= 0 && i < weeks.length)
      .sort((a, b) => a - b)
      .slice(0, 6);
    return idxs.map((i) => {
      const w = weeks[i];
      const completed = r.completedWeeks.includes(w.weekNumber);
      return {
        label: `Week ${w.weekNumber}`,
        hint: w.focus,
        state: completed ? 'completed' : w.weekNumber === curNo ? 'active' : 'upcoming',
      };
    });
  });

  constructor() {
    this.load();
  }

  goToRoadmap(): void {
    const r = this.roadmap();
    if (r) this.router.navigate(['/app/roadmap', r.id]);
  }

  /** Act on the proactive next move (deep-links, optionally prefilling a prompt). */
  goNext(nm: NextAction): void {
    if (!nm.route) return;
    this.router.navigate([nm.route], nm.prompt ? { queryParams: { prompt: nm.prompt } } : {});
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({ profile: this.profiles.getMine(), roadmap: this.roadmaps.getActive() }).subscribe({
      next: ({ profile, roadmap }) => {
        this.profile.set(profile);
        this.roadmap.set(roadmap);
        this.loading.set(false);
        if (profile) {
          this.agent.nextAction().subscribe({ next: (n) => this.nextMove.set(n), error: () => undefined });
        }
        if (profile && roadmap) {
          this.intelligence.overview().subscribe({ next: (d) => this.intel.set(d), error: () => undefined });
        }
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
