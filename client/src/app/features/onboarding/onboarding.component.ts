import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { StudentProfileService } from '../../core/services/student-profile.service';
import { ToastService } from '../../core/services/toast.service';
import {
  BRANCHES,
  Branch,
  CAREER_TARGETS,
  CareerTarget,
  CreateStudentProfilePayload,
  EDUCATION_LEVELS,
  EducationLevel,
  LANGUAGES,
  LEARNING_STYLES,
  LearningStyle,
  SKILL_LEVELS,
  SkillLevel,
  SUGGESTED_GOALS,
  SUGGESTED_SKILLS,
  SUGGESTED_WEAK_AREAS,
  TARGET_TIMELINES,
  TargetTimeline,
  TIME_PER_DAY,
  TimePerDay,
} from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { ChipInputComponent } from '../../shared/ui/chip-input.component';
import { LogoComponent } from '../../shared/ui/logo.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';

interface Draft {
  fullName: string;
  educationLevel: EducationLevel | '';
  branch: Branch | '';
  currentSkillLevel: SkillLevel;
  currentSkills: string[];
  weakAreas: string[];
  mainGoal: string;
  availableTimePerDay: TimePerDay;
  targetTimeline: TargetTimeline;
  preferredLearningStyle: LearningStyle;
  preferredLanguage: string;
  careerTarget: CareerTarget | '';
}

const TOTAL_STEPS = 7;
const DRAFT_KEY = 'asta.onboarding-draft';

@Component({
  selector: 'asta-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(input)': 'persist()', '(change)': 'persist()' },
  imports: [FormsModule, ButtonComponent, ChipInputComponent, LogoComponent, MagneticDirective],
  template: `
    <div class="min-h-screen flex flex-col items-center px-5 py-8">
      <header class="w-full flex justify-center mb-8"><asta-logo /></header>

      <div class="w-full" style="max-width:600px">
        <div class="flex gap-1.5 mb-8">
          @for (s of stepArray; track s) {
            <span class="h-1.5 flex-1 rounded-full transition-all" [class.ob-seg-on]="s <= step()"
              [style.background]="s <= step() ? 'var(--green)' : 'var(--paper-3)'"></span>
          }
        </div>

        <div class="card ob-card" style="padding:28px">
          <p class="kicker mb-3">Step {{ step() }} of {{ totalSteps }}</p>

          @switch (step()) {
            @case (1) {
              <h2 class="text-[26px] mb-5">Let’s get to know you</h2>
              <label class="block mb-4">
                <span class="block mb-1.5 text-sm font-medium text-txt-soft">Full name</span>
                <input class="input" [(ngModel)]="draft.fullName" placeholder="Aarav Sharma" />
              </label>
              <label class="block mb-4">
                <span class="block mb-1.5 text-sm font-medium text-txt-soft">Education level</span>
                <select class="input" [(ngModel)]="draft.educationLevel">
                  <option value="" disabled>Select…</option>
                  @for (o of educationLevels; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                </select>
              </label>
              <label class="block">
                <span class="block mb-1.5 text-sm font-medium text-txt-soft">Branch / field</span>
                <select class="input" [(ngModel)]="draft.branch">
                  <option value="" disabled>Select…</option>
                  @for (o of branches; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                </select>
              </label>
            }

            @case (2) {
              <h2 class="text-[26px] mb-2">Your current level &amp; skills</h2>
              <p class="text-txt-soft mb-4">Where are you right now?</p>
              <div class="flex flex-wrap gap-2 mb-6">
                @for (o of skillLevels; track o.value) {
                  <button type="button" class="seg" [class.seg-on]="draft.currentSkillLevel === o.value"
                    (click)="draft.currentSkillLevel = o.value">{{ o.label }}</button>
                }
              </div>
              <p class="text-sm font-medium text-txt-soft mb-2">Skills you already have</p>
              <asta-chip-input [items]="draft.currentSkills" [suggestions]="suggestedSkills"
                placeholder="Type a skill and press Enter" (itemsChange)="draft.currentSkills = $event" />
            }

            @case (3) {
              <h2 class="text-[26px] mb-2">Where do you struggle?</h2>
              <p class="text-txt-soft mb-4">Weak areas help Asta focus your plan.</p>
              <asta-chip-input [items]="draft.weakAreas" [suggestions]="suggestedWeakAreas"
                accentVar="var(--coral)" placeholder="Type a weak area and press Enter"
                (itemsChange)="draft.weakAreas = $event" />
            }

            @case (4) {
              <h2 class="text-[26px] mb-2">What’s your main goal?</h2>
              <p class="text-txt-soft mb-4">Be specific — this drives your roadmap.</p>
              <textarea class="input" rows="3" [(ngModel)]="draft.mainGoal"
                placeholder="e.g. Become a MERN developer and get an internship in 3 months"></textarea>
              <div class="flex flex-wrap gap-2 mt-4">
                @for (g of suggestedGoals; track g) {
                  <button type="button" class="pill" (click)="draft.mainGoal = g"
                    [style.borderColor]="draft.mainGoal === g ? 'var(--green)' : null" style="cursor:pointer">{{ g }}</button>
                }
              </div>
            }

            @case (5) {
              <h2 class="text-[26px] mb-5">Time &amp; timeline</h2>
              <p class="text-sm font-medium text-txt-soft mb-2">Available time per day</p>
              <div class="flex flex-wrap gap-2 mb-6">
                @for (o of timePerDay; track o.value) {
                  <button type="button" class="seg" [class.seg-on]="draft.availableTimePerDay === o.value"
                    (click)="draft.availableTimePerDay = o.value">{{ o.label }}</button>
                }
              </div>
              <p class="text-sm font-medium text-txt-soft mb-2">Target timeline</p>
              <div class="flex flex-wrap gap-2">
                @for (o of targetTimelines; track o.value) {
                  <button type="button" class="seg" [class.seg-on]="draft.targetTimeline === o.value"
                    (click)="draft.targetTimeline = o.value">{{ o.label }}</button>
                }
              </div>
            }

            @case (6) {
              <h2 class="text-[26px] mb-5">How you learn &amp; aim</h2>
              <p class="text-sm font-medium text-txt-soft mb-2">Preferred learning style</p>
              <div class="flex flex-wrap gap-2 mb-6">
                @for (o of learningStyles; track o.value) {
                  <button type="button" class="seg" [class.seg-on]="draft.preferredLearningStyle === o.value"
                    (click)="draft.preferredLearningStyle = o.value">{{ o.label }}</button>
                }
              </div>
              <label class="block mb-6">
                <span class="block mb-1.5 text-sm font-medium text-txt-soft">Preferred language</span>
                <select class="input" [(ngModel)]="draft.preferredLanguage">
                  @for (l of languages; track l) { <option [value]="l">{{ l }}</option> }
                </select>
              </label>
              <p class="text-sm font-medium text-txt-soft mb-2">Career target</p>
              <div class="flex flex-wrap gap-2">
                @for (o of careerTargets; track o.value) {
                  <button type="button" class="seg" [class.seg-on]="draft.careerTarget === o.value"
                    (click)="draft.careerTarget = o.value">{{ o.label }}</button>
                }
              </div>
            }

            @case (7) {
              <h2 class="text-[26px] mb-5">Review &amp; build</h2>
              <dl class="text-[15px] divide-y" style="border-color:var(--paper-3)">
                <div class="flex justify-between py-2.5"><dt class="text-txt-soft">Name</dt><dd class="font-medium">{{ draft.fullName || '—' }}</dd></div>
                <div class="flex justify-between py-2.5"><dt class="text-txt-soft">Level</dt><dd class="font-medium">{{ labelOf(skillLevels, draft.currentSkillLevel) }}</dd></div>
                <div class="flex justify-between py-2.5"><dt class="text-txt-soft">Goal</dt><dd class="font-medium text-right max-w-[60%]">{{ draft.mainGoal || '—' }}</dd></div>
                <div class="flex justify-between py-2.5"><dt class="text-txt-soft">Skills</dt><dd class="font-medium">{{ draft.currentSkills.length }}</dd></div>
                <div class="flex justify-between py-2.5"><dt class="text-txt-soft">Weak areas</dt><dd class="font-medium">{{ draft.weakAreas.length }}</dd></div>
                <div class="flex justify-between py-2.5"><dt class="text-txt-soft">Time / day</dt><dd class="font-medium">{{ labelOf(timePerDay, draft.availableTimePerDay) }}</dd></div>
                <div class="flex justify-between py-2.5"><dt class="text-txt-soft">Timeline</dt><dd class="font-medium">{{ labelOf(targetTimelines, draft.targetTimeline) }}</dd></div>
              </dl>
            }
          }

          <div class="flex justify-between mt-8">
            <asta-btn variant="ghost" (click)="back()" [disabled]="step() === 1">Back</asta-btn>
            @if (step() < totalSteps) {
              <asta-btn variant="accent" astaMagnetic (click)="next()" [disabled]="!canAdvance()">Continue</asta-btn>
            } @else {
              <asta-btn variant="accent" astaMagnetic (click)="finish()" [loading]="saving()" [disabled]="!isComplete()">Save &amp; continue</asta-btn>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .seg {
        padding: 9px 16px; border-radius: 100px; font-size: 14px; font-weight: 500;
        border: 1px solid var(--paper-3); background: var(--paper); color: var(--text); cursor: pointer;
        transition: all .2s var(--ease);
      }
      .seg:hover { border-color: var(--green-deep); }
      .seg-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

      /* Filled progress segments glow softly so momentum is felt. */
      .ob-seg-on { box-shadow: 0 0 10px var(--asta-accent-glow); }

      /* Step-enter cascade: the @switch re-creates each case's nodes on step
         change, so this insertion animation replays per step — heading first,
         fields following. The static footer/kicker animate once on load. */
      .ob-card > * { animation: astaRevealUp 0.4s var(--ease) both; }
      .ob-card > *:nth-child(3) { animation-delay: 0.05s; }
      .ob-card > *:nth-child(4) { animation-delay: 0.1s; }
      .ob-card > *:nth-child(5) { animation-delay: 0.15s; }
      .ob-card > *:nth-child(6) { animation-delay: 0.2s; }

      @media (prefers-reduced-motion: reduce) {
        .ob-card > * { animation: none; }
        .ob-seg-on { box-shadow: none; }
      }
    `,
  ],
})
export class OnboardingComponent {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(StudentProfileService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly totalSteps = TOTAL_STEPS;
  readonly stepArray = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);
  readonly educationLevels = EDUCATION_LEVELS;
  readonly branches = BRANCHES;
  readonly skillLevels = SKILL_LEVELS;
  readonly timePerDay = TIME_PER_DAY;
  readonly targetTimelines = TARGET_TIMELINES;
  readonly learningStyles = LEARNING_STYLES;
  readonly careerTargets = CAREER_TARGETS;
  readonly languages = LANGUAGES;
  readonly suggestedGoals = SUGGESTED_GOALS;
  readonly suggestedSkills = SUGGESTED_SKILLS;
  readonly suggestedWeakAreas = SUGGESTED_WEAK_AREAS;

  readonly step = signal(1);
  readonly saving = signal(false);

  draft: Draft = {
    fullName: this.auth.user()?.name ?? '',
    educationLevel: '',
    branch: '',
    currentSkillLevel: 'beginner',
    currentSkills: [],
    weakAreas: [],
    mainGoal: '',
    availableTimePerDay: '2hours',
    targetTimeline: '3months',
    preferredLearningStyle: 'mixed',
    preferredLanguage: 'English',
    careerTarget: '',
  };

  constructor() {
    this.restore();
  }

  /** Restore an in-progress draft saved on a previous visit (survives accidental refresh). */
  private restore(): void {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Draft> & { _step?: number };
      this.draft = { ...this.draft, ...saved };
      // Don't trust a name from storage over the live account name if empty.
      if (!this.draft.fullName) this.draft.fullName = this.auth.user()?.name ?? '';
      if (saved._step && saved._step >= 1 && saved._step <= TOTAL_STEPS) this.step.set(saved._step);
      if (saved._step) this.toast.info('Picked up where you left off');
    } catch {
      /* corrupt draft — ignore and start fresh */
    }
  }

  /** Persist the current answers + step. Bound to host input/change so every edit is captured. */
  persist(): void {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...this.draft, _step: this.step() }));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }

  labelOf<T extends string>(opts: { value: T; label: string }[], value: T): string {
    return opts.find((o) => o.value === value)?.label ?? '—';
  }

  canAdvance(): boolean {
    switch (this.step()) {
      case 1:
        return !!this.draft.fullName.trim() && !!this.draft.educationLevel && !!this.draft.branch;
      case 4:
        return this.draft.mainGoal.trim().length >= 3;
      case 6:
        return !!this.draft.careerTarget;
      default:
        return true;
    }
  }

  isComplete(): boolean {
    const d = this.draft;
    return Boolean(d.fullName.trim() && d.educationLevel && d.branch && d.mainGoal.trim() && d.careerTarget);
  }

  next(): void {
    if (this.step() < TOTAL_STEPS && this.canAdvance()) { this.step.update((s) => s + 1); this.persist(); }
  }
  back(): void {
    if (this.step() > 1) { this.step.update((s) => s - 1); this.persist(); }
  }

  finish(): void {
    if (!this.isComplete()) return;
    this.saving.set(true);
    const payload = this.draft as CreateStudentProfilePayload;
    this.profiles.create(payload).subscribe({
      next: () => {
        // Refresh user (isOnboarded → true) then go to roadmap generation.
        this.auth.loadCurrentUser().subscribe({
          next: () => this.go(),
          error: () => this.go(),
        });
      },
      error: () => this.saving.set(false),
    });
  }

  private go(): void {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    this.toast.success('Profile saved — let’s build your roadmap');
    void this.router.navigate(['/app/roadmap/generate']);
  }
}
