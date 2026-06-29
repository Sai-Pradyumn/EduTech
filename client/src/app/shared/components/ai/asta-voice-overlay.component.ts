import { ChangeDetectionStrategy, Component, HostListener, computed, inject } from '@angular/core';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { AuthService } from '../../../core/services/auth.service';
import { VoiceActivationService } from '../../../core/services/voice-activation.service';
import { AstaVoiceOrbComponent } from './asta-voice-orb.component';
import { VoiceCommandConfirmComponent } from './voice-command-confirm.component';

/**
 * The "Hey Asta" voice overlay — a Siri-like surface mounted once for signed-in
 * users. Renders the state machine (consent → listening → thinking → speaking →
 * confirm/success/error) as a centred floating panel on desktop and a bottom
 * sheet on mobile, over a soft blurred backdrop. Bound to ⌘/Ctrl+⇧+A globally;
 * Escape dismisses. All animation is reduced-motion-safe.
 */
@Component({
    selector: 'asta-voice-overlay',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MarkdownPipe, AstaVoiceOrbComponent, VoiceCommandConfirmComponent],
    template: `
    @if (auth.user() && voice.open()) {
      <div class="scrim" (click)="voice.dismiss()" aria-hidden="true"></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Asta voice assistant">
        <header class="vhead">
          <span class="vbrand"><b>Asta</b> <span class="mono">voice</span></span>
          <div class="spacer"></div>
          @if (voice.supported) {
            <button class="vtoggle" [class.on]="voice.wakeEnabled()" (click)="toggleWake()"
              [title]="voice.wakeEnabled() ? '“Hey Asta” wake word: on' : '“Hey Asta” wake word: off'"
              aria-label="Toggle Hey Asta wake word">
              <span class="dot"></span> Hey&nbsp;Asta
            </button>
          }
          <button class="vclose" (click)="voice.dismiss()" title="Close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <div class="vbody" aria-live="polite">
          @if (state() === 'consent') {
            <div class="centered">
              <asta-voice-orb [state]="'idle'" [size]="96" />
              <p class="vtitle">Use your microphone?</p>
              <p class="vsub">Asta listens only while this panel is open (or while you turn on “Hey&nbsp;Asta”). Audio is processed by your browser’s speech service to understand commands — it’s never recorded in the background.</p>
              <div class="cta-row">
                <button class="btn ghost pressable" (click)="voice.dismiss()">Not now</button>
                <button class="btn solid pressable" (click)="voice.grantConsent()">Allow microphone</button>
              </div>
            </div>
          } @else if (state() === 'confirm') {
            <asta-voice-confirm [message]="voice.response()" (confirm)="voice.confirmPending()" (cancel)="voice.cancelPending()" />
          } @else {
            <div class="centered">
              <asta-voice-orb [state]="state()" [size]="128" />
              <p class="vstate">{{ stateLabel() }}</p>

              @if (voice.transcript()) {
                <p class="vheard">“{{ voice.transcript() }}”</p>
              }

              @if (voice.response() && (state() === 'thinking' || state() === 'speaking' || state() === 'error' || state() === 'success')) {
                <div class="vanswer" [innerHTML]="voice.response() | markdown"></div>
              }

              @if (state() === 'listening' || state() === 'idle') {
                <div class="chips">
                  @for (s of voice.suggestions(); track s) {
                    <span class="vchip">{{ s }}</span>
                  }
                </div>
              }

              @if (state() === 'error' || state() === 'idle') {
                <button class="btn solid pressable mt" (click)="voice.activate()">Try again</button>
              }
            </div>
          }
        </div>
      </section>
    }
  `,
    styles: [
        `
      .scrim {
        position: fixed; inset: 0; z-index: 90;
        background: oklch(0.19 0.035 264 / 0.42);
        backdrop-filter: blur(6px);
        animation: fade 0.25s var(--ease);
      }
      .sheet {
        position: fixed; z-index: 91;
        left: 50%; top: 50%; transform: translate(-50%, -50%);
        width: min(440px, calc(100vw - 32px));
        /* Glass sheet — same surface family as the modal / AI dock. */
        background:
          radial-gradient(120% 70% at 0% 0%, color-mix(in oklch, var(--paper-2) 55%, transparent), transparent 58%),
          color-mix(in oklch, var(--paper) 92%, transparent);
        border: 1px solid color-mix(in oklch, var(--paper-3) 85%, transparent);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: var(--r-lg); box-shadow: var(--shadow-lg);
        overflow: hidden; animation: pop 0.3s var(--ease-spring);
      }
      .vhead { display: flex; align-items: center; gap: 8px; padding: 12px 12px 12px 18px; border-bottom: 1px solid var(--paper-3); }
      .vbrand b { font-family: var(--display); font-size: 16px; }
      .vbrand .mono { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mute); }
      .spacer { flex: 1; }
      .vtoggle {
        display: inline-flex; align-items: center; gap: 7px;
        font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em;
        padding: 6px 11px; border-radius: 100px; cursor: pointer;
        border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-mute);
        transition: color 0.2s, border-color 0.2s, background 0.2s;
      }
      .vtoggle .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-mute); }
      .vtoggle.on { color: var(--green-deep); border-color: color-mix(in oklch, var(--green) 50%, transparent); background: color-mix(in oklch, var(--green) 12%, transparent); }
      .vtoggle.on .dot { background: var(--green); box-shadow: 0 0 8px var(--green); animation: blink 1.6s var(--ease) infinite; }
      .vclose { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 100px; border: 0; background: transparent; color: var(--text-mute); cursor: pointer; }
      .vclose:hover { color: var(--text); background: var(--paper-2); }

      .vbody { padding: 26px 24px 28px; min-height: 240px; display: grid; place-items: center; }
      .centered { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; width: 100%; }
      .vstate { font-family: var(--mono); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-deep); margin-top: 14px; }
      .vtitle { font-family: var(--display); font-size: 21px; margin-top: 14px; color: var(--text); }
      .vsub { font-size: 13.5px; color: var(--text-soft); line-height: 1.6; max-width: 360px; margin-top: 8px; }
      .vheard { font-size: 17px; color: var(--text); font-weight: 500; margin-top: 6px; max-width: 360px; }
      .vanswer { font-size: 14px; color: var(--text-soft); line-height: 1.6; text-align: left; margin-top: 12px; max-width: 380px; max-height: 220px; overflow-y: auto; }
      .vanswer :is(p) { margin: 5px 0; }
      .vanswer :is(ul, ol) { margin: 5px 0; padding-left: 18px; }
      .vanswer :is(code) { font-family: var(--mono); background: var(--paper-2); padding: 1px 4px; border-radius: 4px; font-size: 12.5px; }

      .chips { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 16px; }
      .vchip { font-size: 12.5px; color: var(--text-soft); background: var(--paper-2); border: 1px solid var(--paper-3); padding: 6px 12px; border-radius: 100px; }

      .cta-row { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
      .btn { font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 100px; cursor: pointer; border: 1px solid transparent; }
      .btn.ghost { background: transparent; border-color: var(--paper-3); color: var(--text-soft); }
      .btn.ghost:hover { color: var(--text); border-color: var(--text-mute); }
      .btn.solid { background: var(--green); color: var(--ink); }
      .btn.mt { margin-top: 18px; }

      @keyframes fade { from { opacity: 0; } }
      @keyframes pop { from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); } }
      @keyframes blink { 50% { opacity: 0.4; } }

      /* Mobile → bottom sheet, lifted above the bottom-nav + safe area. */
      @media (max-width: 640px) {
        .sheet {
          top: auto; left: 0; right: 0; bottom: 0; transform: none;
          width: 100%; max-width: 100%;
          border-radius: var(--r-lg) var(--r-lg) 0 0;
          padding-bottom: calc(env(safe-area-inset-bottom) + 64px);
          animation: sheetUp 0.32s var(--ease-spring);
        }
      }
      @keyframes sheetUp { from { transform: translateY(100%); } }

      @media (prefers-reduced-motion: reduce) {
        .scrim, .sheet { animation: none; }
        .vtoggle.on .dot { animation: none; }
      }
    `,
    ]
})
export class AstaVoiceOverlayComponent {
  readonly auth = inject(AuthService);
  readonly voice = inject(VoiceActivationService);

  readonly state = computed(() => this.voice.state());

  readonly stateLabel = computed(() => {
    switch (this.state()) {
      case 'listening': return 'Listening…';
      case 'thinking': return 'Thinking…';
      case 'speaking': return 'Speaking…';
      case 'success': return 'Done';
      case 'error': return 'Sorry';
      default: return 'Tap the orb or just speak';
    }
  });

  toggleWake(): void {
    this.voice.setWakeEnabled(!this.voice.wakeEnabled());
  }

  /** Global shortcut: ⌘/Ctrl + ⇧ + A toggles the voice overlay. */
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      if (this.voice.open()) this.voice.dismiss();
      else if (this.auth.user()) this.voice.activate();
      return;
    }
    if (e.key === 'Escape' && this.voice.open()) {
      this.voice.dismiss();
    }
  }
}
