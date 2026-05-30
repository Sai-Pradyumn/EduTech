import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SpeechRecognitionService } from './speech-recognition.service';
import { TextToSpeechService } from './text-to-speech.service';
import { VoiceCommand, VoiceCommandRouterService } from './voice-command-router.service';
import { AuthService } from './auth.service';
import { AgentService } from './agent.service';

export type VoiceState =
  | 'idle' // overlay closed; may be wake-listening in the background
  | 'consent' // first-run privacy prompt
  | 'listening' // capturing a command
  | 'thinking' // resolving / asking the AI
  | 'speaking' // reading the answer aloud
  | 'confirm' // awaiting confirmation for a sensitive action
  | 'success'
  | 'error';

type Mode = 'off' | 'wake' | 'command';

const LS_CONSENT = 'asta.voice.consent';
const LS_WAKE = 'asta.voice.wake';

/**
 * "Hey Asta" voice activation orchestrator. Coordinates the single shared
 * recognition instance across two modes — background wake-word listening (opt-in)
 * and foreground one-shot command capture — runs the captured transcript through
 * the command router, then navigates / asks the Agent OS / speaks the reply,
 * driving a small state machine the overlay renders. Privacy-first: never records
 * until the user consents, wake-listening only runs while the user enables it, and
 * sensitive intents require an explicit confirmation step.
 */
@Injectable({ providedIn: 'root' })
export class VoiceActivationService {
  private readonly recog = inject(SpeechRecognitionService);
  private readonly tts = inject(TextToSpeechService);
  private readonly router = inject(VoiceCommandRouterService);
  private readonly nav = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly agent = inject(AgentService);

  readonly supported = this.recog.supported;
  readonly speaking = this.tts.speaking;

  readonly open = signal(false);
  readonly state = signal<VoiceState>('idle');
  readonly transcript = signal('');
  readonly response = signal('');
  readonly pending = signal<VoiceCommand | null>(null);
  readonly permission = signal<'unknown' | 'granted' | 'denied' | 'unsupported'>(
    this.recog.supported ? 'unknown' : 'unsupported',
  );

  /** Wake-word listening toggle (persisted, opt-in). */
  readonly wakeEnabled = signal(this.readBool(LS_WAKE));

  /** Suggested example commands shown in the listening/idle overlay. */
  readonly suggestions = computed(() =>
    this.auth.isAdmin()
      ? ['Open students', 'Show analytics', 'Open documents', 'Go to fine-tuning']
      : ['Open my roadmap', 'Quiz me on SQL joins', 'Summarise this page', 'What are my weak areas?'],
  );

  private mode: Mode = 'off';
  private pendingTranscript = '';
  private restartGuard = 0;

  constructor() {
    // Resume wake-listening on boot if the user previously enabled it and consented.
    if (this.wakeEnabled() && this.hasConsent() && this.supported) this.startWake();
  }

  // ---- public API -------------------------------------------------------

  /** Manual activation (mic button / ⌘⇧A). Opens the overlay and listens. */
  activate(): void {
    if (!this.supported) {
      this.permission.set('unsupported');
      this.open.set(true);
      this.state.set('error');
      this.response.set('Voice isn’t supported in this browser. Try Chrome or Edge, or use the Ask Asta dock.');
      return;
    }
    this.open.set(true);
    if (!this.hasConsent()) {
      this.state.set('consent');
      return;
    }
    this.beginListening();
  }

  /** User accepted the one-time mic privacy notice. */
  grantConsent(): void {
    this.writeBool(LS_CONSENT, true);
    this.beginListening();
  }

  /** Close the overlay; resume background wake-listening if enabled. */
  dismiss(): void {
    this.open.set(false);
    this.state.set('idle');
    this.transcript.set('');
    this.response.set('');
    this.pending.set(null);
    this.tts.cancel();
    this.mode = 'off';
    this.recog.abort();
    if (this.wakeEnabled() && this.hasConsent()) this.startWake();
  }

  setWakeEnabled(on: boolean): void {
    this.wakeEnabled.set(on);
    this.writeBool(LS_WAKE, on);
    if (on) {
      if (!this.hasConsent()) {
        // Defer until consent is granted via the overlay.
        this.activate();
        return;
      }
      this.startWake();
    } else {
      this.mode = 'off';
      this.recog.abort();
    }
  }

  /** Execute a confirmed sensitive action — only ever routes to a safe screen. */
  confirmPending(): void {
    const t = this.pendingTranscript.toLowerCase();
    const route = /\b(subscription|billing|plan|invoice|payment)\b/.test(t) ? '/app/billing' : '/app/profile';
    this.pending.set(null);
    void this.speakThen('Opening the right screen so you can do that safely.', () => {
      void this.nav.navigateByUrl(route);
      this.state.set('success');
      this.autoDismiss();
    });
  }

  cancelPending(): void {
    this.pending.set(null);
    this.response.set('Cancelled. Nothing was changed.');
    this.state.set('idle');
  }

  // ---- listening / command capture -------------------------------------

  private beginListening(): void {
    this.mode = 'command';
    this.state.set('listening');
    this.transcript.set('');
    this.response.set('');
    this.recog.start({
      continuous: false,
      interimResults: true,
      onStart: () => this.permission.set('granted'),
      onResult: (text, isFinal) => {
        this.transcript.set(text);
        if (isFinal) this.handleCommand(text);
      },
      onError: (code) => this.onRecogError(code),
      onEnd: () => {
        // If we ended while still "listening" with nothing captured, nudge the user.
        if (this.mode === 'command' && this.state() === 'listening' && !this.transcript()) {
          this.response.set('I didn’t hear anything. Tap the orb to try again.');
          this.state.set('idle');
        }
      },
    });
  }

  private handleCommand(rawText: string): void {
    this.recog.abort();
    this.state.set('thinking');
    const cmd = this.router.resolve(rawText, { isAdmin: this.auth.isAdmin() });
    this.run(cmd, rawText);
  }

  private run(cmd: VoiceCommand, rawText: string): void {
    switch (cmd.kind) {
      case 'navigate':
        void this.speakThen(cmd.say || cmd.label, () => {
          if (cmd.route) void this.nav.navigateByUrl(cmd.route);
          this.state.set('success');
          this.autoDismiss();
        });
        break;

      case 'ask':
        this.ask(cmd.question || rawText, cmd.say);
        break;

      case 'speak':
        if (cmd.sensitive) {
          this.pendingTranscript = rawText;
          this.pending.set(cmd);
          this.response.set(cmd.say || '');
          this.state.set('confirm');
          void this.tts.speak(cmd.say || '');
        } else {
          void this.speakThen(cmd.say || '', () => {
            this.state.set('success');
            this.autoDismiss();
          });
        }
        break;

      default:
        this.response.set(cmd.say || 'I’m not sure how to help with that yet.');
        void this.speakThen(this.response(), () => {
          this.state.set('idle');
        });
    }
  }

  /** Forward a question to the Agent OS, stream the answer, then read it aloud. */
  private ask(question: string, lead?: string): void {
    this.state.set('thinking');
    this.response.set('');
    if (lead) void this.tts.speak(lead);
    let answer = '';
    this.agent.stream({ message: question }).subscribe({
      next: (ev) => {
        if (ev.type === 'chunk') {
          answer += ev.delta;
          this.response.set(answer);
        } else if (ev.type === 'completed') {
          answer = ev.response.answer || answer;
          this.response.set(answer);
          this.state.set('speaking');
          void this.tts.speak(answer).then(() => {
            this.state.set('success');
            this.autoDismiss(6000);
          });
        } else if (ev.type === 'error') {
          this.fail(ev.message);
        }
      },
      error: () => this.fail('Something went wrong reaching Asta. Please try again.'),
    });
  }

  // ---- wake-word listening ---------------------------------------------

  private startWake(): void {
    if (!this.supported || this.open()) return;
    this.mode = 'wake';
    this.recog.start({
      continuous: true,
      interimResults: true,
      onStart: () => this.permission.set('granted'),
      onResult: (text, isFinal) => {
        if (!isFinal) return;
        if (!this.router.hasWake(text)) return;
        // Wake heard — take over with the command portion (or listen fresh).
        const remainder = this.router.stripWake(text);
        this.recog.abort();
        this.open.set(true);
        if (remainder) {
          this.transcript.set(remainder);
          this.handleCommand(remainder);
        } else {
          this.beginListening();
        }
      },
      onError: (code) => {
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          this.permission.set('denied');
          this.wakeEnabled.set(false);
          this.writeBool(LS_WAKE, false);
          this.mode = 'off';
        }
      },
      onEnd: () => {
        // Chrome ends continuous recognition after a silence window; restart it
        // (debounced) so wake-listening stays alive — unless we've switched modes.
        if (this.mode === 'wake' && this.wakeEnabled() && !this.open()) {
          const now = Date.now();
          const delay = now - this.restartGuard < 800 ? 800 : 150;
          this.restartGuard = now;
          setTimeout(() => {
            if (this.mode === 'wake' && this.wakeEnabled() && !this.open()) this.startWake();
          }, delay);
        }
      },
    });
  }

  // ---- helpers ----------------------------------------------------------

  private speakThen(text: string, after: () => void): Promise<void> {
    if (text) this.state.set('speaking');
    return this.tts.speak(text).then(after);
  }

  private fail(message: string): void {
    this.response.set(message);
    this.state.set('error');
    void this.tts.speak(message);
  }

  private onRecogError(code: string): void {
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      this.permission.set('denied');
      this.state.set('error');
      this.response.set('Microphone access was blocked. Enable it in your browser settings to use voice.');
    } else if (code === 'no-speech') {
      this.response.set('I didn’t hear anything. Tap the orb to try again.');
      this.state.set('idle');
    } else if (code !== 'aborted') {
      this.state.set('error');
      this.response.set('Voice recognition hit a snag. Please try again.');
    }
  }

  private autoDismiss(ms = 2400): void {
    setTimeout(() => {
      if (!this.open()) return;
      if (this.state() === 'success') this.dismiss();
    }, ms);
  }

  private hasConsent(): boolean {
    return this.readBool(LS_CONSENT);
  }
  private readBool(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }
  private writeBool(key: string, v: boolean): void {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}
