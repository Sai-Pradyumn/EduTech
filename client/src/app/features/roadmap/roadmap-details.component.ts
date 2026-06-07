import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { CountDirective } from '../../shared/directives/count.directive';
import { OfflineToggleComponent } from '../../shared/ui/offline-toggle.component';

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
    MagneticDirective,
    CountDirective,
    OfflineToggleComponent,
    FormsModule,
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
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <asta-offline-toggle kind="roadmap" [refId]="r.id" [title]="r.title" [payload]="r" />
          <asta-btn variant="accent" astaMagnetic routerLink="/app/tutor">Ask Asta <span class="arr">→</span></asta-btn>
          <asta-btn variant="ghost" astaMagnetic routerLink="/app/roadmap/generate">Recalculate</asta-btn>
          <asta-btn variant="ghost" astaMagnetic routerLink="/app/roadmap">All roadmaps</asta-btn>
        </div>
      </header>

      <!-- Overview + progress -->
      <div class="grid gap-5 lg:grid-cols-3 mb-6 motion-row-primary">
        <asta-card class="lg:col-span-2 block motion-card-reveal" [style.--motion-card-index]="0" pad="16px 18px">
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

        <asta-card class="block motion-card-reveal" [style.--motion-card-index]="1" pad="16px 18px">
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
          @if (projection(); as pj) {
            <div class="proj">
              <span class="proj-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              </span>
              <span class="min-w-0"><span class="proj-label">{{ pj.label }}</span><span class="proj-sub">{{ pj.sub }}</span></span>
            </div>
          }
        </asta-card>
      </div>

      <!-- Momentum + next up -->
      <div class="grid gap-5 lg:grid-cols-3 mb-6 motion-card-reveal">
        <asta-card class="block" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker">Momentum</p>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s4 3 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 10 7 12 7 14a5 5 0 0 0 10 0c0-5-5-12-5-12z"/></svg>
            </span>
          </div>
          <div class="flex items-center gap-5 mt-3">
            <div class="text-center shrink-0">
              <p class="text-[30px] font-bold leading-none text-txt" [astaCount]="streak()"></p>
              <p class="text-[11px] text-txt-mute mt-1">day streak</p>
            </div>
            <div class="text-sm text-txt-soft space-y-1 min-w-0">
              <p><span class="font-semibold text-txt">{{ thisWeekCount() }}</span> completion{{ thisWeekCount() === 1 ? '' : 's' }} this week</p>
              <p class="text-txt-mute">{{ lastActiveLabel() }}</p>
            </div>
          </div>
          @if (hasActivity()) {
            <ul class="mt-3 pt-3 border-t border-[color:var(--paper-3)] space-y-1.5">
              @for (a of recentActivity(); track $index) {
                <li class="flex items-center gap-2 text-[13px] text-txt-soft">
                  <span class="act-dot" [class.task]="a.kind === 'task'"></span>
                  <span class="truncate" [title]="a.label">{{ a.label }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="text-[13px] text-txt-mute mt-3">Check off a task or week and your streak starts here.</p>
          }
        </asta-card>

        <asta-card class="lg:col-span-2 block" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker">Next up</p>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
          @if (nextWeek(); as w) {
            <p class="text-[15px] font-semibold mt-2">Week {{ w.weekNumber }} · {{ w.focus }}</p>
            <p class="text-[13px] text-txt-mute">{{ w.title }}</p>
            @if (nextTasks().length) {
              <ul class="mt-3 space-y-2">
                @for (t of nextTasks(); track t.id) {
                  <li class="flex items-start gap-2.5">
                    <button class="nt-check" (click)="toggleTask({ taskId: t.id, completed: true })" [attr.aria-label]="'Mark done: ' + t.text"></button>
                    <span class="text-[14px]">{{ t.text }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-[13px] text-txt-soft mt-3">All tasks in this week are checked off — mark the week complete in the tracker below.</p>
            }
            @if (dailyPlan().length > 1) {
              <button class="daily-toggle" (click)="showDaily.set(!showDaily())">{{ showDaily() ? 'Hide' : 'Show' }} day-by-day plan</button>
              @if (showDaily()) {
                <ol class="daily-plan">
                  @for (day of dailyPlan(); track day.n) {
                    <li class="dp-day">
                      <span class="dp-num">Day {{ day.n }}</span>
                      <span class="dp-tasks">@for (t of day.tasks; track t) { <span class="dp-task">{{ t }}</span> }</span>
                    </li>
                  }
                </ol>
              }
            }
            <div class="regen">
              <input class="regen-note" [ngModel]="regenNote()" (ngModelChange)="regenNote.set($event)" [disabled]="regenerating()"
                placeholder="Adjust this week (optional) — e.g. ‘go deeper on testing’" />
              <button class="regen-btn" [disabled]="regenerating()" (click)="regenerateWeek(w.weekNumber)">
                {{ regenerating() ? 'Regenerating…' : '↻ Regenerate week' }}
              </button>
            </div>
          } @else {
            <p class="text-[15px] mt-2">🎉 Every week is complete. Recalculate for what’s next, or take on a project.</p>
          }
        </asta-card>
      </div>

      <!-- Learning river — path overview -->
      @if (riverNodes().length) {
        <asta-card class="block mb-6 motion-card-reveal motion-strip" pad="16px 18px">
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
      <section class="mb-8 motion-card-reveal motion-row-panel">
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
            <div class="relative motion-row-3" astaScrollDraw>
              <!-- spine: static track + a scroll-drawn accent that fills as you read down -->
              <span class="absolute left-[8px] top-2 bottom-2 w-0.5" style="background:var(--paper-3)"></span>
              <span class="absolute left-[8px] top-2 bottom-2 w-0.5 origin-top" style="background:linear-gradient(var(--green),var(--peri));transform:scaleY(var(--draw,0));transition:transform .12s linear"></span>
              @for (week of r.weeklyPlan; track week.weekNumber; let i = $index) {
                <asta-week-card
                  class="block motion-card-reveal"
                  [style.--motion-card-index]="i"
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
      <section class="mb-8 motion-card-reveal motion-lower">
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
      <section class="mb-8 motion-card-reveal motion-lower">
        <div class="panel-head mb-4">
          <h2 class="text-[20px] leading-tight">Recommended projects</h2>
        </div>
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          @for (p of r.recommendedProjects; track p.title) { <asta-project-card [project]="p" /> }
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-3 motion-lower">
        <!-- Assessment plan -->
        <asta-card class="block motion-card-reveal" [style.--motion-card-index]="0" pad="16px 18px">
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
        <asta-card class="block motion-card-reveal" [style.--motion-card-index]="1" pad="16px 18px">
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
        <asta-card accentVar="var(--peri)" class="block motion-card-reveal" [style.--motion-card-index]="2" pad="16px 18px">
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
      .proj { display: flex; align-items: center; gap: 9px; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--paper-3); }
      .proj-ico { width: 26px; height: 26px; flex-shrink: 0; display: grid; place-items: center; border-radius: 8px; color: var(--peri-deep, #6f86e0); background: color-mix(in oklch, var(--peri, #8aa6ff) 14%, transparent); }
      .proj-label { display: block; font-size: 13px; font-weight: 600; }
      .proj-sub { display: block; font-size: 11.5px; color: var(--text-mute); }
      .act-dot { width: 7px; height: 7px; flex-shrink: 0; border-radius: 50%; background: var(--green); }
      .act-dot.task { background: var(--peri); }
      .regen { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
      .regen-note { flex: 1 1 200px; min-width: 0; padding: 7px 11px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 12.5px; }
      .regen-note:focus { outline: none; border-color: var(--green); }
      .regen-btn { flex: 0 0 auto; padding: 7px 14px; border-radius: 10px; border: 1px solid color-mix(in oklch, var(--peri,#8aa6ff) 35%, var(--paper-3)); background: color-mix(in oklch, var(--peri,#8aa6ff) 10%, transparent); color: var(--peri-deep, #6f86e0); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background .12s; }
      .regen-btn:hover:not(:disabled) { background: color-mix(in oklch, var(--peri,#8aa6ff) 20%, transparent); }
      .regen-btn:disabled { opacity: .6; cursor: default; }
      .daily-toggle { margin-top: 12px; font-size: 12px; color: var(--green-deep); background: transparent; border: none; cursor: pointer; }
      .daily-plan { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; list-style: none; padding: 0; }
      .dp-day { display: grid; grid-template-columns: 52px 1fr; gap: 10px; align-items: start; padding: 6px 8px; border-radius: 9px; background: var(--paper-2); }
      .dp-num { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); padding-top: 2px; }
      .dp-tasks { display: flex; flex-direction: column; gap: 3px; }
      .dp-task { font-size: 12.5px; color: var(--text-soft); }
      .nt-check { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; border-radius: 6px; border: 1.5px solid var(--paper-3); background: var(--paper-2); transition: border-color .15s, background .15s; }
      .nt-check:hover { border-color: var(--green); background: color-mix(in oklch, var(--green) 16%, transparent); }
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

  /**
   * Projected finish, derived from real pace (weeks completed ÷ days elapsed).
   * Returns a friendly label for the Progress card — or a nudge when there's
   * not enough signal yet.
   */
  readonly projection = computed<{ label: string; sub: string } | null>(() => {
    const r = this.roadmap();
    if (!r) return null;
    const total = r.weeklyPlan.length;
    const done = r.completedWeeks.length;
    if (total === 0) return null;
    if (done >= total) return { label: 'Roadmap complete 🎉', sub: 'Every week done' };
    const elapsedDays = Math.max(0, (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000);
    if (done < 1 || elapsedDays < 1) {
      return { label: `${total - done} weeks to go`, sub: 'Finish a week to project your pace' };
    }
    const weeksPerDay = done / elapsedDays;
    const daysLeft = Math.ceil((total - done) / weeksPerDay);
    // Cap absurd projections (very slow pace) to avoid silly far-future dates.
    if (daysLeft > 730) return { label: `${total - done} weeks to go`, sub: 'Pick up the pace to set a finish date' };
    const finish = new Date(Date.now() + daysLeft * 86_400_000);
    const date = finish.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const wk = daysLeft >= 14 ? `~${Math.round(daysLeft / 7)} weeks left` : `~${daysLeft} days left`;
    return { label: `On pace to finish ${date}`, sub: `${wk} at your current rhythm` };
  });

  // ── Momentum (from the activity log) ──
  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  /** Consecutive days (ending today or yesterday) with at least one completion. */
  readonly streak = computed(() => {
    const acts = this.roadmap()?.activity ?? [];
    if (!acts.length) return 0;
    const days = new Set(acts.map((a) => this.dayKey(new Date(a.at))));
    const cur = new Date();
    if (!days.has(this.dayKey(cur))) {
      cur.setDate(cur.getDate() - 1);
      if (!days.has(this.dayKey(cur))) return 0;
    }
    let streak = 0;
    while (days.has(this.dayKey(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    return streak;
  });

  /** Completions in the last 7 days. */
  readonly thisWeekCount = computed(() => {
    const acts = this.roadmap()?.activity ?? [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return acts.filter((a) => new Date(a.at).getTime() >= cutoff).length;
  });

  readonly lastActiveLabel = computed(() => {
    const acts = this.roadmap()?.activity ?? [];
    if (!acts.length) return 'no activity yet';
    const last = acts.reduce((m, a) => (new Date(a.at) > new Date(m.at) ? a : m));
    const ms = Date.now() - new Date(last.at).getTime();
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'active today';
    if (days === 1) return 'active yesterday';
    if (days < 7) return `active ${days} days ago`;
    return `active ${Math.floor(days / 7)}w ago`;
  });

  /** Most recent completions first (for the activity feed). */
  readonly recentActivity = computed(() =>
    [...(this.roadmap()?.activity ?? [])].reverse().slice(0, 5),
  );

  readonly hasActivity = computed(() => (this.roadmap()?.activity?.length ?? 0) > 0);

  /** The next not-yet-finished week — the learner's current focus. */
  readonly nextWeek = computed(() => {
    const r = this.roadmap();
    if (!r) return null;
    return r.weeklyPlan.find((w) => !r.completedWeeks.includes(w.weekNumber)) ?? null;
  });

  /** Up to three still-open tasks in the focus week. */
  readonly nextTasks = computed(() => {
    const r = this.roadmap();
    const w = this.nextWeek();
    if (!r || !w) return [];
    return w.tasks
      .map((text, i) => ({ text, id: `w${w.weekNumber}:t${i}` }))
      .filter((t) => !r.completedTasks.includes(t.id))
      .slice(0, 3);
  });

  readonly showDaily = signal(false);
  readonly regenNote = signal('');
  readonly regenerating = signal(false);

  /** Spread the focus week's tasks across study days (even chunks, max ~6 days). */
  readonly dailyPlan = computed<{ n: number; tasks: string[] }[]>(() => {
    const w = this.nextWeek();
    if (!w || !w.tasks.length) return [];
    const tasks = w.tasks;
    const days = Math.min(6, tasks.length);
    const base = Math.floor(tasks.length / days);
    const extra = tasks.length % days;
    const out: { n: number; tasks: string[] }[] = [];
    let idx = 0;
    for (let d = 0; d < days; d++) {
      const take = base + (d < extra ? 1 : 0);
      out.push({ n: d + 1, tasks: tasks.slice(idx, idx + take) });
      idx += take;
    }
    return out;
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

  regenerateWeek(weekNumber: number): void {
    if (this.regenerating()) return;
    this.regenerating.set(true);
    const note = this.regenNote().trim() || undefined;
    this.service.regenerateWeek(this._id, weekNumber, note).subscribe({
      next: (r) => {
        this.roadmap.set(r);
        this.regenNote.set('');
        this.regenerating.set(false);
        this.showDaily.set(false);
        this.toast.success(`Week ${weekNumber} regenerated`);
      },
      error: (e: Error) => {
        this.regenerating.set(false);
        this.toast.error(e.message || 'Could not regenerate the week');
      },
    });
  }
}
