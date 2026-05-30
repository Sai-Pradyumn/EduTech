import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VoiceApiService } from '../../core/services/lab.service';
import { ToastService } from '../../core/services/toast.service';

interface Turn {
  role: 'you' | 'asta';
  text: string;
}

/**
 * Voice Room (A5). Spoken tutor / mock interview — mic capture + speech synthesis run in the
 * browser via the Web Speech API; transcripts route through the Agent OS server-side.
 * Gated by ENABLE_REALTIME_VOICE (the page shows a notice when disabled).
 */
@Component({
  selector: 'asta-voice-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Voice Room</h1>
        <span class="goal-pill"><span class="dot"></span>Talk to Asta out loud · spoken tutor &amp; mock interview</span>
      </div>
    </header>

    @if (enabled() === false) {
      <div class="card grid place-items-center text-center" style="padding:48px 24px;min-height:240px">
        <div>
          <p class="font-display text-xl mb-1">Voice Room is off</p>
          <p class="text-sm text-txt-soft max-w-md">This feature is behind a flag. Set <code>ENABLE_REALTIME_VOICE=true</code> on the server to talk to Asta out loud.</p>
        </div>
      </div>
    } @else if (enabled()) {
      <div class="grid gap-5 lg:grid-cols-[1fr_minmax(280px,340px)] motion-row-primary">
        <div class="card motion-card-reveal" style="--motion-card-index:0;padding:20px;min-height:340px">
          <div class="flex items-center justify-between mb-3">
            <p class="kicker">Conversation</p>
            <div class="flex gap-1.5">
              @for (m of modes; track m) { <button class="chip" [class.chip-on]="mode() === m" (click)="mode.set(m)">{{ m }}</button> }
            </div>
          </div>
          @if (turns().length === 0) {
            <p class="text-sm text-txt-mute py-8 text-center">Tap the mic and start speaking — or type below.</p>
          }
          <div class="space-y-3">
            @for (t of turns(); track $index) {
              <div [class]="t.role === 'you' ? 'text-right' : ''">
                <span class="bubble" [class.bub-you]="t.role === 'you'">{{ t.text }}</span>
              </div>
            }
          </div>
          @if (thinking()) { <p class="text-xs text-txt-mute mt-3">Asta is thinking…</p> }
        </div>

        <div class="card motion-card-reveal" style="--motion-card-index:1;padding:20px">
          <p class="kicker mb-3">Speak</p>
          <div class="grid place-items-center py-4">
            <button class="mic" [class.mic-on]="listening()" (click)="toggleMic()" [disabled]="!speechSupported">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
            </button>
            <p class="text-xs text-txt-mute mt-2">{{ listening() ? 'Listening…' : speechSupported ? 'Tap to talk' : 'Mic not supported — type below' }}</p>
          </div>
          <div class="flex gap-1.5 mt-2">
            <input class="input" placeholder="…or type a message" [(ngModel)]="typed" (keydown.enter)="sendTyped()" />
            <button class="mv" (click)="sendTyped()" [disabled]="!typed.trim()">↵</button>
          </div>
          @if (speaking()) { <button class="text-[11px] text-txt-mute mt-2" (click)="stopSpeaking()">⏹ Stop speaking</button> }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .chip { font-family: var(--mono); font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); }
      .chip-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .bubble { display: inline-block; max-width: 85%; padding: 9px 13px; border-radius: 14px; background: var(--paper-2); font-size: 14px; text-align: left; }
      .bub-you { background: var(--green); color: var(--ink); }
      .mic { width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; background: var(--paper-2); border: 1px solid var(--paper-3); color: var(--text-soft); transition: all .2s; }
      .mic:hover:not(:disabled) { border-color: var(--green); color: var(--green-deep); }
      .mic-on { background: var(--green); color: var(--ink); border-color: var(--green); animation: pulse 1.4s ease-in-out infinite; }
      .mic:disabled { opacity: .5; }
      @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 oklch(0.80 0.16 150 / .4); } 50% { box-shadow: 0 0 0 12px oklch(0.80 0.16 150 / 0); } }
      .mv { width: 40px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); }
    `,
  ],
})
export class VoiceRoomComponent implements OnInit {
  private readonly api = inject(VoiceApiService);
  private readonly toast = inject(ToastService);

  readonly enabled = signal<boolean | null>(null);
  readonly turns = signal<Turn[]>([]);
  readonly listening = signal(false);
  readonly thinking = signal(false);
  readonly speaking = signal(false);
  readonly mode = signal<'tutor' | 'interview'>('tutor');
  readonly modes: ('tutor' | 'interview')[] = ['tutor', 'interview'];

  typed = '';
  private sessionId?: string;
  private recognition: any;
  readonly speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  ngOnInit(): void {
    this.api.status().subscribe({
      next: (s) => this.enabled.set(s.enabled),
      error: () => this.enabled.set(false),
    });
    this.setupRecognition();
  }

  private setupRecognition(): void {
    const Ctor = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    if (!Ctor) return;
    this.recognition = new Ctor();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      this.send(transcript);
    };
    this.recognition.onend = () => this.listening.set(false);
    this.recognition.onerror = () => this.listening.set(false);
  }

  toggleMic(): void {
    if (!this.recognition) return;
    if (this.listening()) {
      this.recognition.stop();
      this.listening.set(false);
    } else {
      this.stopSpeaking();
      try {
        this.recognition.start();
        this.listening.set(true);
      } catch {
        /* already started */
      }
    }
  }

  sendTyped(): void {
    if (!this.typed.trim()) return;
    const t = this.typed.trim();
    this.typed = '';
    this.send(t);
  }

  private send(transcript: string): void {
    this.turns.update((list) => [...list, { role: 'you', text: transcript }]);
    this.thinking.set(true);
    this.api.ask(transcript, this.sessionId, this.mode()).subscribe({
      next: (turn) => {
        this.thinking.set(false);
        this.sessionId = turn.sessionId;
        this.turns.update((list) => [...list, { role: 'asta', text: turn.text }]);
        this.speak(turn.text);
      },
      error: (e) => {
        this.thinking.set(false);
        this.toast.error(e?.message ?? 'Voice request failed');
      },
    });
  }

  private speak(text: string): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.onstart = () => this.speaking.set(true);
    u.onend = () => this.speaking.set(false);
    window.speechSynthesis.speak(u);
  }

  stopSpeaking(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    this.speaking.set(false);
  }
}
