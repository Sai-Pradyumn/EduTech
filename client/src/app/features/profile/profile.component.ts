import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentProfileService } from '../../core/services/student-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { VoiceActivationService } from '../../core/services/voice-activation.service';
import { MemoryEntry, MemoryService } from '../../core/services/memory.service';
import {
  CreateStudentProfilePayload,
  BRANCHES,
  CAREER_TARGETS,
  EDUCATION_LEVELS,
  LANGUAGES,
  LEARNING_STYLES,
  SKILL_LEVELS,
  SUGGESTED_GOALS,
  SUGGESTED_SKILLS,
  SUGGESTED_WEAK_AREAS,
  TARGET_TIMELINES,
  TIME_PER_DAY,
} from '../../core/models';
import { FieldComponent } from '../../shared/ui/field.component';
import { ChipInputComponent } from '../../shared/ui/chip-input.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';

type Form = Pick<
  CreateStudentProfilePayload,
  | 'fullName'
  | 'educationLevel'
  | 'branch'
  | 'currentSkillLevel'
  | 'currentSkills'
  | 'weakAreas'
  | 'mainGoal'
  | 'availableTimePerDay'
  | 'targetTimeline'
  | 'preferredLearningStyle'
  | 'preferredLanguage'
  | 'careerTarget'
>;

/**
 * `/app/profile` — Profile & settings (B1). Edit the onboarding fields, learning
 * preferences, app language + theme. Real data via StudentProfileService; the
 * loading / empty / error / saving states are honest (Workstream E).
 */
@Component({
    selector: 'asta-profile',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, DatePipe, FieldComponent, ChipInputComponent, SkeletonComponent, EmptyStateComponent, MagneticDirective],
    template: `
    @if (loading()) {
      <div class="mx-auto" style="max-width:var(--maxw-app)">
        @for (n of [1, 2, 3]; track n) {
          <div class="card mb-4" style="padding:20px">
            <asta-skeleton w="30%" h="16px" />
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <asta-skeleton h="42px" /><asta-skeleton h="42px" /><asta-skeleton h="42px" /><asta-skeleton h="42px" />
            </div>
          </div>
        }
      </div>
    } @else if (error()) {
      <asta-empty-state title="Couldn't load your profile" [description]="error()!">
        <button type="button" class="btn-primary" (click)="load()">Retry</button>
      </asta-empty-state>
    } @else {
      <header class="asta-page-command-header mx-auto" style="max-width:var(--maxw-app)">
        <div class="min-w-0">
          <h1 class="text-[26px] leading-tight mb-2 grad-flow">Profile &amp; settings</h1>
          <span class="goal-pill"><span class="dot"></span>Your identity, learning preferences, appearance &amp; voice</span>
        </div>
      </header>
      @if (form(); as f) {
      <form class="mx-auto" style="max-width:var(--maxw-app)" (ngSubmit)="save()">
        <!-- Account -->
        <section class="card mb-4 p-5 md:p-6 motion-card-reveal motion-row-primary" style="--motion-card-index:0">
          <div class="sec-head">
            <div class="flex items-center gap-3">
              <span class="pf-avatar" aria-hidden="true">{{ initial() }}</span>
              <div>
                <h2 class="t-h-card mb-0.5">Account</h2>
                <p class="t-small text-txt-mute">Your identity across Asta.</p>
              </div>
            </div>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
          </div>
          <div class="grid gap-x-4 sm:grid-cols-2 mt-4">
            <asta-field label="Full name">
              <input class="input" [(ngModel)]="f.fullName" name="fullName" required />
            </asta-field>
            <asta-field label="Email" hint="Contact support to change your email.">
              <input class="input" [value]="auth.user()?.email ?? ''" disabled />
            </asta-field>
          </div>
          @if (meta(); as m) {
            <div class="acct-meta">
              <div class="am"><span class="am-v">{{ m.createdAt | date: 'mediumDate' }}</span><span class="am-l">Member since</span></div>
              <div class="am"><span class="am-v">{{ memberDays() }} {{ memberDays() === 1 ? 'day' : 'days' }}</span><span class="am-l">With Asta</span></div>
              <div class="am"><span class="am-v" [style.color]="m.onboardingCompleted ? 'var(--green-deep)' : 'var(--text-mute)'">{{ m.onboardingCompleted ? 'Complete' : 'Incomplete' }}</span><span class="am-l">Onboarding</span></div>
              <div class="am"><span class="am-v capitalize">{{ auth.user()?.role ?? '—' }}</span><span class="am-l">Account type</span></div>
            </div>
          }
        </section>

        <!-- Learning profile -->
        <section class="card mb-4 p-5 md:p-6 motion-card-reveal motion-row-2" style="--motion-card-index:0">
          <div class="sec-head mb-4">
            <div>
              <h2 class="t-h-card mb-0.5">Learning profile</h2>
              <p class="t-small text-txt-mute">These shape every roadmap, quiz and tutor reply.</p>
            </div>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19c0-8 7-14 16-14M4 19h.01M20 5h.01"/></svg>
            </span>
          </div>

          <asta-field label="Main goal">
            <input class="input" [(ngModel)]="f.mainGoal" name="mainGoal" list="goal-suggestions" placeholder="e.g. Become a MERN Stack Developer" />
            <datalist id="goal-suggestions">
              @for (g of goals; track g) { <option [value]="g"></option> }
            </datalist>
          </asta-field>

          <div class="grid gap-x-4 sm:grid-cols-2">
            <asta-field label="Education level">
              <select class="input" [(ngModel)]="f.educationLevel" name="educationLevel">
                @for (o of educationLevels; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </asta-field>
            <asta-field label="Branch">
              <select class="input" [(ngModel)]="f.branch" name="branch">
                @for (o of branches; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </asta-field>
            <asta-field label="Current skill level">
              <select class="input" [(ngModel)]="f.currentSkillLevel" name="currentSkillLevel">
                @for (o of skillLevels; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </asta-field>
            <asta-field label="Career target">
              <select class="input" [(ngModel)]="f.careerTarget" name="careerTarget">
                @for (o of careerTargets; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </asta-field>
            <asta-field label="Time per day">
              <select class="input" [(ngModel)]="f.availableTimePerDay" name="availableTimePerDay">
                @for (o of timePerDay; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </asta-field>
            <asta-field label="Target timeline">
              <select class="input" [(ngModel)]="f.targetTimeline" name="targetTimeline">
                @for (o of timelines; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </asta-field>
            <asta-field label="Preferred learning style">
              <select class="input" [(ngModel)]="f.preferredLearningStyle" name="preferredLearningStyle">
                @for (o of learningStyles; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </asta-field>
          </div>

          <asta-field label="Current skills">
            <asta-chip-input [items]="f.currentSkills" [suggestions]="suggestedSkills" placeholder="Add a skill…"
              (itemsChange)="f.currentSkills = $event" />
          </asta-field>
          <asta-field label="Weak areas" hint="What you want to get better at.">
            <asta-chip-input [items]="f.weakAreas" [suggestions]="suggestedWeak" accentVar="var(--coral)" placeholder="Add a weak area…"
              (itemsChange)="f.weakAreas = $event" />
          </asta-field>
        </section>

        <!-- Preferences -->
        <section class="card mb-4 p-5 md:p-6 motion-card-reveal motion-row-2" style="--motion-card-index:1">
          <div class="sec-head mb-4">
            <div>
              <h2 class="t-h-card mb-0.5">Preferences</h2>
              <p class="t-small text-txt-mute">Appearance and language.</p>
            </div>
            <span class="panel-ico peri" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
            </span>
          </div>

          <asta-field label="Appearance">
            <div class="flex flex-wrap gap-2">
              @for (m of themeModes; track m.value) {
                <button type="button" class="seg" [class.on]="theme.mode() === m.value" (click)="theme.set(m.value)">{{ m.label }}</button>
              }
            </div>
          </asta-field>

          <div class="grid gap-x-4 sm:grid-cols-2">
            <asta-field label="App language" hint="Interface language.">
              <select class="input" [ngModel]="i18n.locale()" name="appLang" (ngModelChange)="i18n.setLocale($event)">
                @for (l of i18n.locales; track l.code) { <option [value]="l.code">{{ l.label }} · {{ l.english }}</option> }
              </select>
            </asta-field>
            <asta-field label="Content language" hint="Language for generated lessons & replies.">
              <select class="input" [(ngModel)]="f.preferredLanguage" name="preferredLanguage">
                @for (l of languages; track l) { <option [value]="l">{{ l }}</option> }
              </select>
            </asta-field>
          </div>
        </section>

        <!-- Memory manager: everything Asta knows, deletable -->
        <section class="card mb-4 p-5 md:p-6 motion-card-reveal motion-row-3" style="--motion-card-index:1">
          <div class="sec-head mb-4">
            <div>
              <h2 class="t-h-card mb-0.5">What Asta remembers</h2>
              <p class="t-small text-txt-mute">Facts that personalize your learning. Delete anything — or say “forget …” in any chat.</p>
            </div>
            <span class="panel-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4 4 0 0 0-4 4 4 4 0 0 0-3 6.5A4 4 0 0 0 7 21h10a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7a4 4 0 0 0-4-4Z"/></svg>
            </span>
          </div>

          @if (!memoryLoaded()) {
            <button type="button" class="seg" (click)="loadMemories()">Show memories</button>
          } @else if (memories().length === 0) {
            <p class="t-small text-txt-mute">Nothing saved yet. Say “remember that I prefer video lessons” in any chat, or approve a memory card in Asta OS.</p>
          } @else {
            <ul class="space-y-2">
              @for (m of memories(); track m.id) {
                <li class="mem-row">
                  <span class="mem-badge" [class.observed]="m.source === 'observed'">{{ m.source === 'observed' ? 'observed' : 'you approved' }}</span>
                  <span class="min-w-0 flex-1 text-[13.5px]">{{ m.text }}</span>
                  <button type="button" class="mem-del" (click)="deleteMemory(m)">
                    {{ armedMemory() === m.id ? 'Confirm delete?' : 'Delete' }}
                  </button>
                </li>
              }
            </ul>
            <p class="t-small text-txt-mute mt-3">Deleting removes it from Asta’s context immediately — answers stop being shaped by it.</p>
          }
        </section>

        <!-- Voice -->
        <section class="card mb-4 p-5 md:p-6 motion-card-reveal motion-row-3" style="--motion-card-index:0">
          <div class="sec-head mb-4">
            <div>
              <h2 class="t-h-card mb-0.5">Voice</h2>
              <p class="t-small text-txt-mute">Hands-free “Hey Asta” activation and spoken replies.</p>
            </div>
            <span class="panel-ico coral" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
            </span>
          </div>

          @if (!voice.supported) {
            <p class="t-small text-txt-mute">Voice isn’t supported in this browser. Try Chrome or Edge to enable “Hey Asta”.</p>
          } @else {
            <asta-field label="Wake word" hint="Listen in the background for “Hey Asta”, then act on what you say.">
              <div class="flex flex-wrap gap-2">
                <button type="button" class="seg" [class.on]="voice.wakeEnabled()" (click)="voice.setWakeEnabled(true)">On</button>
                <button type="button" class="seg" [class.on]="!voice.wakeEnabled()" (click)="voice.setWakeEnabled(false)">Off</button>
              </div>
            </asta-field>
            <asta-field label="Microphone" hint="Spoken replies use your browser’s voice; nothing is recorded until you consent.">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="pill" [style.color]="micColor()">{{ micLabel() }}</span>
                <button type="button" class="seg" (click)="voice.activate()">Test voice</button>
              </div>
            </asta-field>
          }
        </section>

        <div class="flex items-center justify-end gap-3 pb-2">
          @if (savedAt()) { <span class="t-small text-txt-mute">Saved.</span> }
          <button type="submit" class="btn-primary" astaMagnetic [disabled]="saving() || !f.fullName.trim()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>
      }
    }
  `,
    styles: [
        `
      .sec-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .pf-avatar {
        display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px;
        background: linear-gradient(135deg, var(--green-deep), var(--green));
        color: var(--ink); font-size: 20px; font-weight: 700; flex-shrink: 0;
        box-shadow: 0 8px 24px var(--asta-accent-glow);
      }
      .acct-meta {
        display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
        margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--paper-3);
      }
      @media (min-width: 640px) { .acct-meta { grid-template-columns: repeat(4, 1fr); } }
      .am { display: flex; flex-direction: column; gap: 1px; }
      .am-v { font-size: 14px; font-weight: 600; }
      .am-l { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); }
      .seg {
        font-size: 13px; padding: 8px 16px; border-radius: 100px; border: 1px solid var(--paper-3);
        background: var(--paper); color: var(--text-soft); transition: all .15s var(--ease); min-height: 40px;
      }
      .seg:hover { border-color: var(--accent); }
      .seg.on { background: var(--accent); color: var(--ink); border-color: var(--accent); font-weight: 600; }
      .btn-primary {
        font-weight: 600; font-size: 15px; padding: 11px 22px; border-radius: 100px; min-height: 44px;
        background: var(--accent); color: var(--ink); transition: transform .12s var(--ease-spring), opacity .15s;
      }
      .btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
      .btn-primary:active:not(:disabled) { transform: scale(.97); }
      .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
      .mem-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--paper-2); }
      .mem-badge { font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; padding: 2px 8px; border-radius: 999px; flex-shrink: 0; background: color-mix(in oklab, var(--green) 16%, transparent); color: var(--green-deep); }
      .mem-badge.observed { background: color-mix(in oklab, var(--peri, #8aa6ff) 14%, transparent); color: var(--peri-deep, #6f86e0); }
      .mem-del { font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 999px; border: 1px solid var(--paper-3); background: transparent; color: var(--text-mute); cursor: pointer; flex-shrink: 0; transition: color .14s, border-color .14s; }
      .mem-del:hover { color: var(--danger, #e0654f); border-color: color-mix(in oklab, var(--danger, #e0654f) 45%, var(--paper-3)); }
    `,
    ]
})
export class ProfileComponent implements OnInit {
  private readonly svc = inject(StudentProfileService);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  readonly voice = inject(VoiceActivationService);
  private readonly toast = inject(ToastService);

  /** Microphone-permission badge copy + colour for the Voice section. */
  micLabel(): string {
    switch (this.voice.permission()) {
      case 'granted': return 'Allowed';
      case 'denied': return 'Blocked — enable it in browser settings';
      case 'unsupported': return 'Unsupported';
      default: return 'Not requested yet';
    }
  }
  micColor(): string {
    switch (this.voice.permission()) {
      case 'granted': return 'var(--green-deep)';
      case 'denied': return 'var(--danger)';
      default: return 'var(--text-mute)';
    }
  }

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly savedAt = signal(false);
  readonly form = signal<Form | null>(null);

  // ── Memory manager: everything Asta knows, deletable ──
  private readonly memoryApi = inject(MemoryService);
  readonly memories = signal<MemoryEntry[]>([]);
  readonly memoryLoaded = signal(false);
  /** Two-step delete confirmation (auto-disarms after 4s). */
  readonly armedMemory = signal<string | null>(null);

  loadMemories(): void {
    this.memoryApi.listAll().subscribe({
      next: (list) => {
        this.memories.set(list);
        this.memoryLoaded.set(true);
      },
      error: () => this.toast.error('Could not load memories'),
    });
  }

  deleteMemory(m: MemoryEntry): void {
    if (this.armedMemory() !== m.id) {
      this.armedMemory.set(m.id);
      setTimeout(() => {
        if (this.armedMemory() === m.id) this.armedMemory.set(null);
      }, 4000);
      return;
    }
    this.armedMemory.set(null);
    this.memoryApi.remove(m).subscribe({
      next: () => {
        this.memories.update((l) => l.filter((x) => x.id !== m.id));
        this.toast.success('Forgotten — it no longer shapes your answers');
      },
      error: () => this.toast.error('Could not delete this memory'),
    });
  }
  /** Read-only account metadata surfaced in the Account section (from the loaded profile). */
  readonly meta = signal<{ createdAt: string; onboardingCompleted: boolean } | null>(null);

  /** Avatar initial — prefers the edited form name, falls back to the session user. */
  initial(): string {
    const n = this.form()?.fullName?.trim() || this.auth.user()?.name?.trim() || 'A';
    return n[0].toUpperCase();
  }

  memberDays(): number {
    const c = this.meta()?.createdAt;
    if (!c) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(c).getTime()) / 86400000));
  }

  readonly educationLevels = EDUCATION_LEVELS;
  readonly branches = BRANCHES;
  readonly skillLevels = SKILL_LEVELS;
  readonly timePerDay = TIME_PER_DAY;
  readonly timelines = TARGET_TIMELINES;
  readonly learningStyles = LEARNING_STYLES;
  readonly careerTargets = CAREER_TARGETS;
  readonly languages = LANGUAGES;
  readonly goals = SUGGESTED_GOALS;
  readonly suggestedSkills = SUGGESTED_SKILLS;
  readonly suggestedWeak = SUGGESTED_WEAK_AREAS;
  readonly themeModes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getMine().subscribe({
      next: (p) => {
        this.form.set({
          fullName: p?.fullName ?? this.auth.user()?.name ?? '',
          educationLevel: p?.educationLevel ?? 'btech',
          branch: p?.branch ?? 'cse',
          currentSkillLevel: p?.currentSkillLevel ?? 'beginner',
          currentSkills: [...(p?.currentSkills ?? [])],
          weakAreas: [...(p?.weakAreas ?? [])],
          mainGoal: p?.mainGoal ?? '',
          availableTimePerDay: p?.availableTimePerDay ?? '1hour',
          targetTimeline: p?.targetTimeline ?? '3months',
          preferredLearningStyle: p?.preferredLearningStyle ?? 'mixed',
          preferredLanguage: p?.preferredLanguage ?? 'English',
          careerTarget: p?.careerTarget ?? 'fulltime',
        });
        this.meta.set(p ? { createdAt: p.createdAt, onboardingCompleted: p.onboardingCompleted } : null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('We could not reach the server. Check your connection and retry.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    const f = this.form();
    if (!f || !f.fullName.trim()) return;
    this.saving.set(true);
    this.savedAt.set(false);
    this.svc.update(f).subscribe({
      next: () => {
        this.saving.set(false);
        this.savedAt.set(true);
        this.toast.success('Profile updated.');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Could not save your profile. Please try again.');
      },
    });
  }
}
