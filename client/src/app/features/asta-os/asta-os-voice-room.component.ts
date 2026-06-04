import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { VoiceActivationService } from '../../core/services/voice-activation.service';
import { AstaOrbState } from './asta-os.types';
import { AstaOsOrbComponent } from './asta-os-orb.component';

/**
 * Fullscreen voice experience. Wraps the existing VoiceActivationService (wake
 * word, STT → Agent OS → TTS) in an immersive room: a large state-driven orb,
 * live transcript + spoken reply, mic control, wake toggle, and a privacy note.
 * Closing returns to chat; nothing records audio until the learner taps the mic.
 */
@Component({
  selector: 'asta-os-voice-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'asta-os-root' },
  imports: [AstaOsOrbComponent],
  template: `
    <div class="room">
      <header class="bar">
        <span class="brand">Asta · Voice</span>
        <button type="button" class="close" (click)="close.emit()" aria-label="Leave voice">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <div class="stage">
        <asta-os-orb [state]="orbState()" size="hero" [label]="statusLabel()" />

        @if (!voice.supported) {
          <p class="note warn">Voice isn’t supported in this browser. Try Chrome or Edge — or just type to Asta in chat.</p>
        } @else {
          @if (voice.transcript(); as t) { <p class="you">“{{ t }}”</p> }
          @if (voice.response(); as r) { <p class="asta" aria-live="polite">{{ r }}</p> }
          @if (!voice.transcript() && !voice.response()) {
            <p class="hint">Tap the mic and say something like “Teach me React hooks” or “Quiz me on arrays”.</p>
          }
        }
      </div>

      <footer class="controls">
        <button
          type="button"
          class="mic"
          [class.live]="voice.state() === 'listening'"
          [disabled]="!voice.supported"
          (click)="voice.activate()"
          aria-label="Talk to Asta"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>
        <button type="button" class="toggle" [class.on]="voice.wakeEnabled()" (click)="voice.setWakeEnabled(!voice.wakeEnabled())">
          <span class="dot"></span> “Hey Asta” {{ voice.wakeEnabled() ? 'on' : 'off' }}
        </button>
        <p class="privacy">Audio is processed only while you’re talking. Nothing is recorded in the background unless you turn on the wake word.</p>
      </footer>
    </div>
  `,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 85; display: block; }
      .room { position: absolute; inset: 0; display: flex; flex-direction: column; background: radial-gradient(ellipse at 50% 30%, var(--asta-bg-soft), var(--asta-bg)); }
      .bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; }
      .brand { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--asta-muted); }
      .close { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; color: var(--asta-muted); }
      .close:hover { color: var(--asta-text); background: var(--asta-panel); }

      .stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; text-align: center; padding: 16px 24px; }
      .you { font-size: 18px; color: var(--asta-muted); max-width: 640px; }
      .asta { font-size: 22px; line-height: 1.5; color: var(--asta-text); max-width: 720px; }
      .hint { font-size: 15px; color: var(--asta-subtle); max-width: 520px; }
      .note.warn { color: var(--asta-gold); max-width: 520px; }

      .controls { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 22px 24px 36px; }
      .mic { display: grid; place-items: center; width: 76px; height: 76px; border-radius: 999px; color: var(--asta-text); border: 1px solid var(--asta-border); background: var(--asta-panel); transition: transform .16s ease, background .16s ease, box-shadow .2s ease; }
      .mic:hover:not(:disabled) { transform: translateY(-2px); }
      .mic:disabled { opacity: .4; cursor: default; }
      .mic.live { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); box-shadow: 0 0 30px color-mix(in srgb, var(--asta-green) 55%, transparent); }
      .toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--asta-muted); padding: 7px 14px; border-radius: 999px; border: 1px solid var(--asta-border); }
      .toggle .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--asta-subtle); }
      .toggle.on { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .toggle.on .dot { background: var(--asta-green); box-shadow: 0 0 8px var(--asta-green); }
      .privacy { font-size: 11.5px; color: var(--asta-subtle); max-width: 460px; text-align: center; line-height: 1.5; }
    `,
  ],
})
export class AstaOsVoiceRoomComponent {
  protected readonly voice = inject(VoiceActivationService);
  readonly close = output<void>();

  private readonly map: Record<string, AstaOrbState> = {
    idle: 'idle',
    consent: 'idle',
    listening: 'listening',
    thinking: 'thinking',
    speaking: 'speaking',
    confirm: 'warning',
    success: 'success',
    error: 'error',
  };
  protected readonly orbState = computed<AstaOrbState>(() => this.map[this.voice.state()] ?? 'idle');

  private readonly labels: Record<string, string> = {
    idle: 'Tap to talk',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    confirm: 'Confirm?',
    success: 'Done',
    error: 'Try again',
    consent: 'Allow mic',
  };
  protected readonly statusLabel = computed(() => this.labels[this.voice.state()] ?? 'Tap to talk');
}
