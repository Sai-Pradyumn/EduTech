import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoadmapService } from '../../core/services/roadmap.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { Roadmap } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { ProgressComponent } from '../../shared/ui/progress.component';
import { ProgressWidgetComponent } from './components/progress-widget.component';
import { WeekCardComponent, TaskToggle } from './components/week-card.component';
import { MilestoneCardComponent } from './components/milestone-card.component';
import { ProjectCardComponent } from './components/project-card.component';
import { ScrollDrawDirective } from '../../shared/directives/scroll-draw.directive';
import { AstaLearningRiverComponent, AstaStepTrackerComponent, RiverNode, StepItem, StepState } from '../../shared/ui/synapse';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { TiltDirective } from '../../shared/directives/tilt.directive';
import { CountDirective } from '../../shared/directives/count.directive';

@Component({
  selector: 'asta-roadmap-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ButtonComponent,
    CardComponent,
    BadgeComponent,
    SkeletonComponent,
    RingComponent,
    ProgressComponent,
    ProgressWidgetComponent,
    WeekCardComponent,
    MilestoneCardComponent,
    ProjectCardComponent,
    ScrollDrawDirective,
    AstaLearningRiverComponent,
    AstaStepTrackerComponent,
    RevealDirective,
    MagneticDirective,
    TiltDirective,
    CountDirective,
  ],
  template: `
    @if (loading()) {
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <asta-skeleton h="34px" w="280px" />
        <asta-skeleton h="40px" w="200px" />
      </div>
      <div class="grid gap-5 lg:grid-cols-3 mb-8">
        <asta-skeleton h="240px" class="lg:col-span-2" />
        <asta-skeleton h="240px" />
      </div>
      <asta-skeleton h="320px" />
    } @else if (error()) {
      <asta-card>
        <div class="text-center py-10">
          <p class="text-txt-soft mb-4">Couldn’t load this roadmap — let’s get you back on track.</p>
          <div class="flex justify-center gap-3">
            <asta-btn variant="accent" size="sm" astaMagnetic (click)="load()">Retry</asta-btn>
            <asta-btn variant="ghost" size="sm" routerLink="/app/roadmap">Back to roadmaps</asta-btn>
          </div>
        </div>
      </asta-card>
    } @else if (roadmap()) {
      @if (roadmap(); as r) {
      <!-- Compact command header -->
      <header class="asta-page-command-header">
        <div class="min-w-0">
          <a routerLink="/app/roadmap" class="text-[13px] text-txt-mute hover:text-txt inline-block mb-1.5">← My roadmaps</a>
          <h1 class="text-[26px] leading-tight mb-2 grad-flow">{{ r.title }}</h1>
          <div class="flex flex-wrap items-center gap-2">
            <span class="goal-pill"><span class="dot"></span>{{ r.goal }}</span>
            <asta-badge [tone]="r.status === 'active' ? 'success' : r.status === 'completed' ? 'info' : 'warning'">{{ r.status }}</asta-badge>
            <span class="pill capitalize">{{ r.difficulty }}</span>
            <span class="pill">{{ r.estimatedDuration }}</span>
          </div>
        </div>
        <div class="flex gap-2.5 shrink-0">
          <asta-btn variant="accent" astaMagnetic routerLink="/app/tutor">Ask Asta <span class="arr">→</span></asta-btn>
          <asta-btn variant="ghost" astaMagnetic routerLink="/app/roadmap">All roadmaps</asta-btn>
        </div>
      </header>

      <!-- Overview + progress -->
      <div class="grid gap-5 lg:grid-cols-3 mb-6" [astaReveal]="0">
        <asta-card class="lg:col-span-2" astaTilt [tiltMax]="3" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker">Overview</p>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>
            </span>
          </div>
          <p class="text-[15px] text-txt-soft mt-2 leading-relaxed">{{ r.overview }}</p>
          <div class="mt-4 pt-4 border-t border-[color:var(--paper-3)]">
            <p class="kicker mb-1.5">Goal</p>
            <p class="text-[15px]">{{ r.goal }}</p>
          </div>
        </asta-card>

        <asta-card astaTilt [tiltMax]="5" pad="16px 18px">
          <p class="kicker mb-3">Progress</p>
          <div class="flex items-center gap-4">
            <asta-ring [value]="r.progressPercentage" [size]="92" />
            <div class="text-sm text-txt-soft space-y-1">
              <p><span class="font-semibold text-txt" [astaCount]="r.completedWeeks.length"></span>/{{ r.weeklyPlan.length }} weeks</p>
              <p><span class="font-semibold text-txt" [astaCount]="milestonesReached()"></span>/{{ r.milestones.length }} milestones</p>
              <p><span class="font-semibold text-txt" [astaCount]="r.completedTasks.length"></span> tasks done</p>
            </div>
          </div>
          <div class="mt-4">
            <asta-progress [value]="r.progressPercentage" />
          </div>
        </asta-card>
      </div>

      <!-- Learning river — path overview -->
      @if (riverNodes().length) {
        <asta-card [astaReveal]="1" class="block mb-6" pad="16px 18px">
          <div class="panel-head">
            <div>
              <p class="kicker mb-1">Learning river</p>
              <h2 class="t-h-card">Your path through {{ r.title }}</h2>
            </div>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c3 0 3-4 6-4s3 4 6 4 3-4 6-4"/><path d="M3 18c3 0 3-4 6-4s3 4 6 4 3-4 6-4"/></svg>
            </span>
          </div>
          <div class="mt-3">
            <asta-learning-river [nodes]="riverNodes()" />
          </div>
        </asta-card>
      }

      <!-- Weekly plan — step tracker overview + detailed week cards -->
      <section class="mb-8" [astaReveal]="2">
        <div class="grid gap-5 lg:grid-cols-3">
          <asta-card class="lg:col-span-1" pad="16px 18px">
            <div class="panel-head">
              <p class="kicker">Week tracker</p>
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span>
            </div>
            <p class="text-[13px] text-txt-mute mt-2 mb-3">Mark a week complete as you finish it.</p>
            <asta-step-tracker [steps]="weekSteps()" (toggle)="toggleWeekByIndex($event)" />
          </asta-card>

          <div class="lg:col-span-2">
            <div class="panel-head mb-3">
              <h2 class="text-[20px] leading-tight">Weekly plan</h2>
            </div>
            <div class="relative" astaScrollDraw>
              <!-- spine: static track + a scroll-drawn accent that fills as you read down -->
              <span class="absolute left-[8px] top-2 bottom-2 w-0.5" style="background:var(--paper-3)"></span>
              <span class="absolute left-[8px] top-2 bottom-2 w-0.5 origin-top" style="background:linear-gradient(var(--green),var(--peri));transform:scaleY(var(--draw,0));transition:transform .12s linear"></span>
              @for (week of r.weeklyPlan; track week.weekNumber) {
                <asta-week-card
                  [week]="week"
                  [completed]="r.completedWeeks.includes(week.weekNumber)"
                  [isCurrent]="week.weekNumber === currentWeek()"
                  [completedTasks]="r.completedTasks"
                  (weekToggle)="toggleWeek(week.weekNumber, $event)"
                  (taskToggle)="toggleTask($event)" />
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Milestones -->
      <section class="mb-8" [astaReveal]="3">
        <div class="panel-head mb-4">
          <h2 class="text-[20px] leading-tight">Milestones</h2>
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          @for (m of r.milestones; track m.title) {
            <asta-milestone-card [milestone]="m" [reached]="r.completedWeeks.length >= m.targetWeek" />
          }
        </div>
      </section>

      <!-- Projects -->
      <section class="mb-8" [astaReveal]="4">
        <div class="panel-head mb-4">
          <h2 class="text-[20px] leading-tight">Recommended projects</h2>
        </div>
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          @for (p of r.recommendedProjects; track p.title) { <asta-project-card [project]="p" /> }
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-3" [astaReveal]="5">
        <!-- Assessment plan -->
        <asta-card astaTilt [tiltMax]="4" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker">Assessment plan</p>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M12 3v0M4 7h6M4 12h4M4 17h8"/></svg>
            </span>
          </div>
          <ul class="space-y-3 mt-3">
            @for (a of r.assessmentPlan; track a.title) {
              <li class="flex items-start gap-3">
                <span class="pill shrink-0">W{{ a.week }}</span>
                <div>
                  <p class="text-sm font-semibold">{{ a.title }}</p>
                  <p class="text-[13px] text-txt-mute capitalize">{{ a.type }}</p>
                </div>
              </li>
            }
          </ul>
        </asta-card>

        <!-- Daily study plan -->
        <asta-card astaTilt [tiltMax]="4" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker">Daily study plan</p>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </span>
          </div>
          <ul class="text-sm text-txt-soft space-y-2 mt-3">
            @for (d of r.dailyStudyPlan; track d) { <li class="flex gap-2"><span style="color:var(--green-deep)">•</span> {{ d }}</li> }
          </ul>
        </asta-card>

        <!-- Success tips -->
        <asta-card accentVar="var(--peri)" astaTilt [tiltMax]="4" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker" style="color:var(--peri-deep)">Success tips</p>
            <span class="panel-ico peri" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
            </span>
          </div>
          <ul class="text-sm text-txt-soft space-y-2 mt-3">
            @for (t of r.successTips; track t) { <li class="flex gap-2"><span style="color:var(--peri-deep)">→</span> {{ t }}</li> }
          </ul>
        </asta-card>
      </div>
      }
    }
  `,
  styles: [
    `
      .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .panel-ico {
        width: 32px; height: 32px; flex-shrink: 0;
        display: grid; place-items: center;
        border-radius: 10px;
        color: var(--green-deep);
        background: color-mix(in oklch, var(--green) 13%, transparent);
        transition: transform 0.4s var(--ease-spring);
      }
      .panel-ico.peri { color: var(--peri-deep); background: color-mix(in oklch, var(--peri) 15%, transparent); }
      asta-card:hover .panel-ico { transform: scale(1.14) rotate(-8deg); }
    `,
  ],
})
export class RoadmapDetailsComponent {
  private readonly service = inject(RoadmapService);
  private readonly toast = inject(ToastService);
  private readonly confetti = inject(ConfettiService);

  /** Bound from the :id route param via withComponentInputBinding(). */
  @Input() set id(value: string) {
    this._id = value;
    this.load();
  }
  private _id = '';

  readonly roadmap = signal<Roadmap | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  /** First not-yet-completed week = the "current" week marker. */
  readonly currentWeek = computed(() => {
    const r = this.roadmap();
    if (!r) return 1;
    const next = r.weeklyPlan.find((w) => !r.completedWeeks.includes(w.weekNumber));
    return next?.weekNumber ?? r.weeklyPlan.length;
  });

  readonly milestonesReached = computed(() => {
    const r = this.roadmap();
    if (!r) return 0;
    return r.milestones.filter((m) => m.targetWeek <= r.completedWeeks.length).length;
  });

  /** Roadmap weeks as tracker steps (active week reveals its tasks). */
  readonly weekSteps = computed<StepItem[]>(() => {
    const r = this.roadmap();
    if (!r) return [];
    const curNo = this.currentWeek();
    return r.weeklyPlan.map((w) => {
      const completed = r.completedWeeks.includes(w.weekNumber);
      const state: StepState = completed ? 'completed' : w.weekNumber === curNo ? 'active' : 'upcoming';
      return { title: `Week ${w.weekNumber} · ${w.focus}`, detail: w.title, tasks: w.tasks, state, actionable: true };
    });
  });

  /** Milestones (or sampled weeks) as a compact flowing learning river. */
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
    const curNo = this.currentWeek();
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

  load(): void {
    if (!this._id) return;
    this.loading.set(true);
    this.error.set(false);
    this.service.getById(this._id).subscribe({
      next: (r) => {
        this.roadmap.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Step tracker emits the step index → map to the matching week number. */
  toggleWeekByIndex(i: number): void {
    const r = this.roadmap();
    const w = r?.weeklyPlan[i];
    if (!w) return;
    const completed = r!.completedWeeks.includes(w.weekNumber);
    this.toggleWeek(w.weekNumber, !completed);
  }

  toggleWeek(weekNumber: number, completed: boolean): void {
    this.service.updateProgress(this._id, { weekNumber, weekCompleted: completed }).subscribe({
      next: (r) => {
        this.roadmap.set(r);
        if (completed) {
          this.toast.success(`Week ${weekNumber} marked complete`);
          // Finishing the final week completes the roadmap → celebrate (D2).
          if (r.completedWeeks.length >= r.weeklyPlan.length && r.weeklyPlan.length > 0) {
            this.confetti.burst({ y: 0.3, count: 160 });
          }
        }
      },
    });
  }

  toggleTask(t: TaskToggle): void {
    this.service.updateProgress(this._id, { taskId: t.taskId, taskCompleted: t.completed }).subscribe({
      next: (r) => this.roadmap.set(r),
    });
  }
}
