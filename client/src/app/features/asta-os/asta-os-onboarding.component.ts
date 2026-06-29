import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AstaOsOrbComponent } from './asta-os-orb.component';

export interface AstaOnboardChoice {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
}

/**
 * First-entry choice screen. A warm, one-tap way to start a session — picks a
 * surface (chat/voice/face) or a goal (roadmap/practice/weak areas/project). Shown
 * once (the shell persists the dismissal); emits the chosen key, or `skip`.
 */
@Component({
    selector: 'asta-os-onboarding',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AstaOsOrbComponent],
    template: `
    <div class="scrim"></div>
    <section class="card" role="dialog" aria-modal="true" aria-label="How do you want to start?">
      <div class="hero">
        <asta-os-orb size="lg" state="idle" />
        <h1>{{ greeting() }}</h1>
        <p class="sub">How do you want to learn today? Pick one — Asta takes it from here.</p>
      </div>

      <div class="grid">
        @for (c of choices; track c.key) {
          <button type="button" class="choice" (click)="choose.emit(c.key)">
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="c.icon" /></svg></span>
            <span class="meta"><span class="label">{{ c.label }}</span><span class="hint">{{ c.hint }}</span></span>
          </button>
        }
      </div>

      <button type="button" class="skip" (click)="skip.emit()">Just open the workspace →</button>
    </section>
  `,
    styles: [
        `
      :host { position: fixed; inset: 0; z-index: 90; display: block; }
      .scrim { position: absolute; inset: 0; background: rgba(2,5,4,.72); backdrop-filter: blur(8px); animation: fade .25s ease; }
      .card { position: absolute; inset: 0; margin: auto; width: min(720px, 94vw); max-height: 92vh; overflow-y: auto; height: fit-content; padding: 32px 28px; border-radius: 24px; background: var(--asta-bg-soft); border: 1px solid var(--asta-border); box-shadow: 0 40px 120px rgba(0,0,0,.6); animation: rise .3s cubic-bezier(.2,.7,.2,1); }
      @keyframes fade { from { opacity: 0; } }
      @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
      @media (prefers-reduced-motion: reduce) { .scrim, .card { animation: none; } }

      .hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; margin-bottom: 24px; }
      .hero h1 { font-family: var(--display); font-size: 26px; font-weight: 600; }
      .sub { font-size: 14.5px; color: var(--asta-muted); max-width: 440px; line-height: 1.5; }

      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
      @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
      .choice { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 14px; border: 1px solid var(--asta-border); background: var(--asta-panel); text-align: left; transition: transform .14s ease, border-color .14s ease, background .14s ease; }
      .choice:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); background: var(--asta-panel-strong); }
      .ic { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; color: var(--asta-green); background: color-mix(in srgb, var(--asta-green) 12%, transparent); flex-shrink: 0; }
      .meta { display: flex; flex-direction: column; line-height: 1.3; }
      .label { font-size: 14px; font-weight: 600; color: var(--asta-text); }
      .hint { font-size: 12px; color: var(--asta-muted); }

      .skip { display: block; margin: 22px auto 0; font-size: 13px; color: var(--asta-muted); }
      .skip:hover { color: var(--asta-text); }
    `,
    ]
})
export class AstaOsOnboardingComponent {
  readonly greeting = input('Welcome to Asta OS');
  readonly choose = output<string>();
  readonly skip = output<void>();

  protected readonly choices: AstaOnboardChoice[] = [
    { key: 'chat', label: 'Chat with Asta', hint: 'Type to learn, ask, plan', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z' },
    { key: 'voice', label: 'Speak with Asta', hint: 'Hands-free voice session', icon: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3' },
    { key: 'face', label: 'Face Asta', hint: 'A mentor-style call', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 10h.01M15.5 10h.01M8.5 15a4 4 0 0 0 7 0' },
    { key: 'roadmap', label: 'Continue my roadmap', hint: 'Pick up where you left off', icon: 'M4 19c0-8 7-14 16-14M4 19h.01M20 5h.01' },
    { key: 'practice', label: 'Practice coding', hint: 'Real editor + runner', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
    { key: 'weak', label: 'Fix my weak areas', hint: 'Repair what’s blocking you', icon: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' },
    { key: 'project', label: 'Build a project', hint: 'Learn by building', icon: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5' },
    { key: 'interview', label: 'Prepare for interview', hint: 'Mock interview practice', icon: 'M3 5h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z' },
  ];
}
