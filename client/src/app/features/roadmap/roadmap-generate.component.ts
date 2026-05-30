import { UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RoadmapService } from '../../core/services/roadmap.service';
import { StudentProfileService } from '../../core/services/student-profile.service';
import { ToastService } from '../../core/services/toast.service';
import { StudentProfile, TARGET_TIMELINES, TIME_PER_DAY, TargetTimeline, TimePerDay } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';

@Component({
  selector: 'asta-roadmap-generate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, UpperCasePipe, ButtonComponent, CardComponent, SkeletonComponent, MagneticDirective],
  template: `
    <div class="mx-auto" style="max-width:var(--max-w-app,720px)">
      @if (generating()) {
        <asta-card>
          <div class="cinema text-center">
            <div class="orb" aria-hidden="true"><span></span><span></span><span></span></div>
            <h2 class="text-[24px] mb-1">Building your path</h2>
            <p class="text-sm text-txt-mute mb-6">The Roadmap Agent is composing your week-by-week plan.</p>
            <ol class="stages" aria-hidden="true">
              @for (s of stages; track s; let i = $index) {
                <li [class.done]="i < stage()" [class.active]="i === stage()">
                  <span class="mk">
                    @if (i < stage()) {
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    }
                  </span>
                  {{ s }}
                </li>
              }
            </ol>
            <p class="sr-line font-mono text-sm text-txt-mute" aria-live="polite">{{ loaderLine() }}</p>
          </div>
        </asta-card>
      } @else if (loadingProfile()) {
        <asta-card><asta-skeleton h="24px" w="50%" /><div class="mt-4"><asta-skeleton h="120px" /></div></asta-card>
      } @else if (!profile()) {
        <asta-card>
          <div class="text-center py-10">
            <p class="text-txt-soft mb-4">Complete onboarding first so Asta knows your goal.</p>
            <asta-btn variant="accent" routerLink="/onboarding">Start onboarding</asta-btn>
          </div>
        </asta-card>
      } @else {
        <header class="asta-page-command-header">
          <div class="min-w-0">
            <h1 class="text-[26px] leading-tight mb-2 grad-flow">Generate your roadmap</h1>
            <span class="goal-pill"><span class="dot"></span>A personalized, week-by-week plan from your profile</span>
          </div>
        </header>

        @if (profile(); as p) {
          <asta-card class="block motion-card-reveal motion-row-primary">
            <p class="kicker mb-3">Your profile</p>
            <div class="flex flex-wrap gap-2 mb-2">
              <span class="pill">{{ p.currentSkillLevel }}</span>
              <span class="pill">{{ p.branch | uppercase }}</span>
              @for (s of p.currentSkills.slice(0, 5); track s) { <span class="pill">{{ s }}</span> }
            </div>
            @if (p.weakAreas.length) {
              <p class="text-sm text-txt-soft">Focus areas: {{ p.weakAreas.join(', ') }}</p>
            }
          </asta-card>

          <div class="mt-5 space-y-5">
            <label class="block">
              <span class="block mb-1.5 text-sm font-medium text-txt-soft">Goal</span>
              <textarea class="input" rows="2" [(ngModel)]="goal"></textarea>
            </label>

            <div>
              <p class="text-sm font-medium text-txt-soft mb-2">Timeline</p>
              <div class="flex flex-wrap gap-2">
                @for (o of timelines; track o.value) {
                  <button type="button" class="seg" [class.seg-on]="timeline() === o.value" (click)="timeline.set(o.value)">{{ o.label }}</button>
                }
              </div>
            </div>

            <div>
              <p class="text-sm font-medium text-txt-soft mb-2">Daily intensity</p>
              <div class="flex flex-wrap gap-2">
                @for (o of intensities; track o.value) {
                  <button type="button" class="seg" [class.seg-on]="intensity() === o.value" (click)="intensity.set(o.value)">{{ o.label }}</button>
                }
              </div>
            </div>

            @if (error()) {
              <div class="card" style="padding:14px 16px;border-color:var(--danger)">
                <p class="text-sm" style="color:var(--danger)">{{ error() }}</p>
              </div>
            }

            <div class="flex gap-3">
              <asta-btn variant="accent" astaMagnetic (click)="generate()" [loading]="generating()" [disabled]="!goal.trim()">Generate roadmap</asta-btn>
              <asta-btn variant="ghost" routerLink="/app/roadmap">My roadmaps</asta-btn>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .seg { padding: 9px 16px; border-radius: 100px; font-size: 14px; font-weight: 500; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text); cursor: pointer; transition: all .2s var(--ease); }
      .seg:hover { border-color: var(--green-deep); }
      .seg-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

      /* "Build my path" cinematic (D2) */
      .cinema { padding: 44px 24px 36px; }
      .orb { position: relative; width: 86px; height: 86px; margin: 0 auto 22px; display: grid; place-items: center; }
      .orb span {
        position: absolute; inset: 0; border-radius: 50%; border: 2px solid transparent;
        border-top-color: var(--green-deep); animation: orbspin 1.1s linear infinite;
      }
      .orb span:nth-child(2) { inset: 12px; border-top-color: var(--peri-deep); animation-duration: 1.5s; animation-direction: reverse; }
      .orb span:nth-child(3) { inset: 24px; border-top-color: var(--coral-deep); animation-duration: 1.9s; }
      @keyframes orbspin { to { transform: rotate(360deg); } }
      .stages { display: inline-flex; flex-direction: column; gap: 11px; text-align: left; margin: 0 auto 22px; }
      .stages li { display: flex; align-items: center; gap: 11px; font-size: 14.5px; color: var(--text-mute); transition: color .3s var(--ease); }
      .stages .mk {
        display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
        border: 2px solid var(--paper-3); color: var(--on-ink); transition: all .3s var(--ease);
      }
      .stages li.done { color: var(--text); }
      .stages li.done .mk { background: var(--green-deep); border-color: var(--green-deep); }
      .stages li.active { color: var(--text); font-weight: 600; }
      .stages li.active .mk { border-color: var(--green-deep); animation: mkpulse 1s var(--ease) infinite; }
      @keyframes mkpulse { 0%,100% { box-shadow: 0 0 0 0 oklch(0.62 0.15 150 / .45); } 50% { box-shadow: 0 0 0 6px oklch(0.62 0.15 150 / 0); } }
      @media (prefers-reduced-motion: reduce) {
        .orb span { animation: none; } .stages li.active .mk { animation: none; }
      }
    `,
  ],
})
export class RoadmapGenerateComponent {
  private readonly profiles = inject(StudentProfileService);
  private readonly roadmaps = inject(RoadmapService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly timelines = TARGET_TIMELINES;
  readonly intensities = TIME_PER_DAY;

  readonly profile = signal<StudentProfile | null>(null);
  readonly loadingProfile = signal(true);
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);
  readonly stages = ['Analyzing your profile', 'Sequencing modules', 'Planning weekly tasks', 'Adding projects & checkpoints', 'Finalizing milestones'];
  readonly stage = signal(0);
  readonly loaderLine = signal('Analyzing your profile…');

  goal = '';
  readonly timeline = signal<TargetTimeline>('3months');
  readonly intensity = signal<TimePerDay>('2hours');

  constructor() {
    this.profiles.getMine().subscribe({
      next: (p) => {
        this.profile.set(p);
        if (p) {
          this.goal = p.mainGoal;
          this.timeline.set(p.targetTimeline);
          this.intensity.set(p.availableTimePerDay);
        }
        this.loadingProfile.set(false);
      },
      error: () => this.loadingProfile.set(false),
    });
  }

  generate(): void {
    if (!this.goal.trim()) return;
    this.error.set(null);
    this.generating.set(true);
    this.cycleLoader();
    this.roadmaps
      .generate({ goal: this.goal.trim(), targetTimeline: this.timeline(), availableTimePerDay: this.intensity() })
      .subscribe({
        next: (roadmap) => {
          this.toast.success('Your roadmap is ready');
          void this.router.navigate(['/app/roadmap', roadmap.id]);
        },
        error: (err: Error) => {
          this.generating.set(false);
          this.error.set(err.message || 'Generation failed. Please try again.');
        },
      });
  }

  private cycleLoader(): void {
    this.stage.set(0);
    this.loaderLine.set(`${this.stages[0]}…`);
    let i = 0;
    const tick = setInterval(() => {
      i += 1;
      // Advance through stages, holding on the last until the response arrives.
      if (i <= this.stages.length - 1 && this.generating()) {
        this.stage.set(i);
        this.loaderLine.set(`${this.stages[i]}…`);
      } else {
        clearInterval(tick);
      }
    }, 850);
  }
}
