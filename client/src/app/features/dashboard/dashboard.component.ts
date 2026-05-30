import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RoadmapService } from '../../core/services/roadmap.service';
import { StudentProfileService } from '../../core/services/student-profile.service';
import { IntelligenceService } from '../../core/services/intelligence.service';
import { LearningIntelligence, Roadmap, RoadmapWeek, StudentProfile } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { ProgressComponent } from '../../shared/ui/progress.component';

@Component({
  selector: 'asta-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent, RingComponent, ProgressComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-7">
      <div>
        <h1 class="text-[28px] mb-1.5">{{ greeting() }}, {{ firstName() }}</h1>
        @if (profile(); as p) { <span class="pill"><span class="dot"></span>{{ p.mainGoal }}</span> }
      </div>
      @if (roadmap()) { <asta-btn variant="accent" [routerLink]="['/app/roadmap', roadmap()!.id]">Continue learning</asta-btn> }
    </div>

    @if (loading()) {
      <div class="grid gap-5 md:grid-cols-3">
        @for (i of [1, 2, 3]; track i) { <asta-card><asta-skeleton h="22px" w="60%" /><div class="mt-4"><asta-skeleton h="70px" /></div></asta-card> }
      </div>
    } @else if (error()) {
      <asta-card><div class="text-center py-8"><p class="text-txt-soft mb-4">Couldn’t load your dashboard.</p><asta-btn variant="ghost" size="sm" (click)="load()">Retry</asta-btn></div></asta-card>

    } @else if (!profile()) {
      <!-- Not onboarded -->
      <asta-card>
        <asta-empty-state title="Welcome to Asta" description="Tell us your goal and how you learn, and Asta will map your path.">
          <asta-btn variant="accent" routerLink="/onboarding">Complete onboarding</asta-btn>
        </asta-empty-state>
      </asta-card>

    } @else if (!roadmap()) {
      <!-- Onboarded, no roadmap -->
      <asta-card>
        <asta-empty-state title="Let’s build your roadmap" description="You’re all set up. Generate a personalized, week-by-week roadmap for your goal.">
          <div class="flex gap-3">
            <asta-btn variant="accent" routerLink="/app/roadmap/generate">Generate roadmap</asta-btn>
            <asta-btn variant="ghost" routerLink="/app/tutor">Ask the tutor</asta-btn>
          </div>
        </asta-empty-state>
      </asta-card>

    } @else if (roadmap()) {
      @if (roadmap(); as r) {
      <!-- Roadmap exists: intelligent dashboard -->
      <div class="grid gap-5 lg:grid-cols-3">
        <!-- Active roadmap (wide) -->
        <asta-card accentVar="var(--green)" class="lg:col-span-2">
          <p class="kicker mb-2">Active roadmap</p>
          <h2 class="text-[20px] mb-1">{{ r.title }}</h2>
          <p class="text-sm text-txt-soft mb-4">{{ r.estimatedDuration }}</p>
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-1"><asta-progress [value]="r.progressPercentage" /></div>
            <span class="font-mono text-sm text-txt-soft">{{ r.progressPercentage }}%</span>
          </div>
          @if (currentWeek(); as w) {
            <div class="rounded-[14px] p-4" style="background:var(--paper-2)">
              <p class="font-mono text-[11px] uppercase tracking-wider text-txt-mute mb-1">Current — Week {{ w.weekNumber }}</p>
              <p class="font-semibold mb-2">{{ w.focus }}</p>
              <ul class="text-sm text-txt-soft space-y-1">
                @for (t of w.tasks.slice(0, 3); track t) { <li class="flex gap-2"><span style="color:var(--green-deep)">•</span>{{ t }}</li> }
              </ul>
            </div>
          }
          <div class="mt-4"><asta-btn variant="accent" size="sm" [routerLink]="['/app/roadmap', r.id]">Continue →</asta-btn></div>
        </asta-card>

        <!-- Progress ring -->
        <asta-card>
          <p class="kicker mb-3">Progress</p>
          <div class="flex items-center gap-4">
            <asta-ring [value]="r.progressPercentage" [size]="92" />
            <div class="text-sm text-txt-soft space-y-1">
              <p><span class="font-semibold text-txt">{{ r.completedWeeks.length }}</span>/{{ r.weeklyPlan.length }} weeks</p>
              <p><span class="font-semibold text-txt">{{ milestonesReached() }}</span>/{{ r.milestones.length }} milestones</p>
            </div>
          </div>
        </asta-card>
      </div>

      <!-- Learning intelligence banner -->
      @if (intel(); as li) {
        <a routerLink="/app/progress" class="card block mt-5" style="padding:16px 18px;text-decoration:none">
          <div class="flex flex-wrap items-center gap-5">
            <div class="text-center"><asta-ring [value]="li.healthScore" [size]="64" /><p class="text-[11px] text-txt-mute mt-1">Health</p></div>
            <div class="text-center"><asta-ring [value]="li.readinessScore" [size]="64" tone="peri" /><p class="text-[11px] text-txt-mute mt-1">Readiness</p></div>
            <div class="flex-1 min-w-[200px]">
              <p class="kicker mb-1">Learning intelligence</p>
              <p class="text-sm text-txt-soft">{{ li.headline }}</p>
            </div>
            <span class="text-sm font-semibold" style="color:var(--green-deep)">Open cockpit →</span>
          </div>
        </a>
      }

      <div class="grid gap-5 md:grid-cols-3 mt-5">
        <!-- Next milestone -->
        <asta-card accentVar="var(--peri)">
          <p class="kicker mb-2" style="color:var(--peri-deep)">Next milestone</p>
          @if (nextMilestone(); as m) {
            <p class="font-semibold mb-1">{{ m.title }}</p>
            <p class="text-sm text-txt-soft">Target: week {{ m.targetWeek }}</p>
          } @else { <p class="text-sm text-txt-soft">All milestones reached 🎉</p> }
        </asta-card>

        <!-- Weak areas -->
        <asta-card accentVar="var(--coral)">
          <p class="kicker mb-2" style="color:var(--coral-deep)">Weak areas</p>
          @if (profile()!.weakAreas.length) {
            <div class="flex flex-wrap gap-1.5">
              @for (w of profile()!.weakAreas; track w) { <span class="pill" style="color:var(--coral-deep);border-color:var(--coral)">{{ w }}</span> }
            </div>
          } @else { <p class="text-sm text-txt-soft">None flagged.</p> }
        </asta-card>

        <!-- Recommended project -->
        <asta-card>
          <p class="kicker mb-2">Recommended project</p>
          @if (r.recommendedProjects[0]; as proj) {
            <p class="font-semibold mb-1">{{ proj.title }}</p>
            <p class="text-sm text-txt-soft line-clamp-2">{{ proj.description }}</p>
          }
        </asta-card>
      </div>

      <!-- Recommended actions -->
      <div class="flex flex-wrap gap-3 mt-6">
        <asta-btn variant="ghost" size="sm" [routerLink]="['/app/roadmap', r.id]">Continue roadmap</asta-btn>
        <asta-btn variant="ghost" size="sm" routerLink="/app/tutor">Ask AI Tutor</asta-btn>
        <asta-btn variant="ghost" size="sm" routerLink="/app/quizzes">Take a quiz</asta-btn>
        <asta-btn variant="ghost" size="sm" routerLink="/app/projects">Start a project</asta-btn>
      </div>
      }
    }
  `,
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(StudentProfileService);
  private readonly roadmaps = inject(RoadmapService);
  private readonly intelligence = inject(IntelligenceService);

  readonly profile = signal<StudentProfile | null>(null);
  readonly roadmap = signal<Roadmap | null>(null);
  readonly intel = signal<LearningIntelligence | null>(null);
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

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({ profile: this.profiles.getMine(), roadmap: this.roadmaps.getActive() }).subscribe({
      next: ({ profile, roadmap }) => {
        this.profile.set(profile);
        this.roadmap.set(roadmap);
        this.loading.set(false);
        // Intelligence is a non-blocking enhancement — never breaks the dashboard.
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
