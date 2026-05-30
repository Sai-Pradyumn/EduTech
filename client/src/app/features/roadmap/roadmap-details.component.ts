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
import { ProgressWidgetComponent } from './components/progress-widget.component';
import { WeekCardComponent, TaskToggle } from './components/week-card.component';
import { MilestoneCardComponent } from './components/milestone-card.component';
import { ProjectCardComponent } from './components/project-card.component';
import { ScrollDrawDirective } from '../../shared/directives/scroll-draw.directive';

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
    ProgressWidgetComponent,
    WeekCardComponent,
    MilestoneCardComponent,
    ProjectCardComponent,
    ScrollDrawDirective,
  ],
  template: `
    @if (loading()) {
      <asta-card><asta-skeleton h="28px" w="55%" /><div class="mt-4"><asta-skeleton h="160px" /></div></asta-card>
    } @else if (error()) {
      <asta-card>
        <div class="text-center py-10">
          <p class="text-txt-soft mb-4">Couldn’t load this roadmap.</p>
          <div class="flex justify-center gap-3">
            <asta-btn variant="ghost" size="sm" (click)="load()">Retry</asta-btn>
            <asta-btn variant="ghost" size="sm" routerLink="/app/roadmap">Back to roadmaps</asta-btn>
          </div>
        </div>
      </asta-card>
    } @else if (roadmap()) {
      @if (roadmap(); as r) {
      <!-- Header -->
      <div class="mb-6">
        <a routerLink="/app/roadmap" class="text-sm text-txt-mute hover:text-txt">← My roadmaps</a>
        <div class="flex flex-wrap items-start justify-between gap-4 mt-2">
          <div class="min-w-0">
            <h1 class="text-[28px] leading-tight mb-2">{{ r.title }}</h1>
            <div class="flex flex-wrap gap-2">
              <asta-badge [tone]="r.status === 'active' ? 'success' : r.status === 'completed' ? 'info' : 'warning'">{{ r.status }}</asta-badge>
              <span class="pill">{{ r.difficulty }}</span>
              <span class="pill">{{ r.estimatedDuration }}</span>
            </div>
          </div>
        </div>
        <p class="text-txt-soft mt-4 max-w-2xl">{{ r.overview }}</p>
      </div>

      <div class="grid gap-5 lg:grid-cols-3 mb-8">
        <div class="lg:col-span-2">
          <asta-card>
            <p class="kicker mb-2">Goal</p>
            <p class="text-[17px]">{{ r.goal }}</p>
          </asta-card>
        </div>
        <asta-progress-widget [roadmap]="r" />
      </div>

      <!-- Weekly plan -->
      <section class="mb-10">
        <h2 class="text-[22px] mb-4">Weekly plan</h2>
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
      </section>

      <!-- Milestones -->
      <section class="mb-10">
        <h2 class="text-[22px] mb-4">Milestones</h2>
        <div class="grid gap-5 sm:grid-cols-2">
          @for (m of r.milestones; track m.title) {
            <asta-milestone-card [milestone]="m" [reached]="r.completedWeeks.length >= m.targetWeek" />
          }
        </div>
      </section>

      <!-- Projects -->
      <section class="mb-10">
        <h2 class="text-[22px] mb-4">Recommended projects</h2>
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          @for (p of r.recommendedProjects; track p.title) { <asta-project-card [project]="p" /> }
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-3">
        <!-- Assessment plan -->
        <asta-card>
          <p class="kicker mb-3">Assessment plan</p>
          <ul class="space-y-3">
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
        <asta-card>
          <p class="kicker mb-3">Daily study plan</p>
          <ul class="text-sm text-txt-soft space-y-2">
            @for (d of r.dailyStudyPlan; track d) { <li class="flex gap-2"><span style="color:var(--green-deep)">•</span> {{ d }}</li> }
          </ul>
        </asta-card>

        <!-- Success tips -->
        <asta-card accentVar="var(--peri)">
          <p class="kicker mb-3" style="color:var(--peri-deep)">Success tips</p>
          <ul class="text-sm text-txt-soft space-y-2">
            @for (t of r.successTips; track t) { <li class="flex gap-2"><span style="color:var(--peri-deep)">→</span> {{ t }}</li> }
          </ul>
        </asta-card>
      </div>
      }
    }
  `,
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
