import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AgentService } from '../../core/services/agent.service';
import { AuthService } from '../../core/services/auth.service';
import { MarkdownPipe } from '../pipes/markdown.pipe';
import { ComposerComponent, ComposerSubmit } from '../ui/composer.component';
import { AgentStreamEvent } from '../../core/models';

interface DockMsg {
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
}

/**
 * Always-on AI dock — a floating launcher (bottom-right) that expands into a
 * compact streaming chat, available on every authed screen. Routes through the
 * Agent OS (auto-classifies intent), can read answers aloud (TTS) and take
 * dictation via the shared composer. Talking orb pulses while speaking.
 * Mounted once in AppComponent; only renders for signed-in users.
 */
@Component({
    selector: 'asta-ai-dock',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MarkdownPipe, ComposerComponent],
    template: `
    @if (auth.user()) {
      <!-- Launcher -->
      @if (!open()) {
        <button class="launcher" (click)="toggle()" aria-label="Ask Asta">
          <span class="orb" [class.speaking]="speaking()"></span>
          <span class="launcher-label">Ask&nbsp;Asta</span>
        </button>
      }

      <!-- Panel -->
      @if (open()) {
        <section class="panel" role="dialog" aria-label="Asta AI assistant">
          <header class="head">
            <span class="orb sm" [class.speaking]="speaking()"></span>
            <div class="head-text">
              <b>Asta</b>
              <span class="mono">{{ busy() ? 'thinking…' : 'always on' }}</span>
            </div>
            <button class="hbtn" [class.on]="readAloud()" (click)="toggleReadAloud()" [title]="readAloud() ? 'Read answers aloud: on' : 'Read answers aloud: off'" aria-label="Toggle read aloud">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
            </button>
            <button class="hbtn" (click)="toggle()" title="Close" aria-label="Close">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>

          <div class="body" aria-live="polite">
            @if (messages().length === 0) {
              <div class="intro">
                <p class="intro-h">How can I help?</p>
                <p class="intro-p">Ask anything — I'll route you to the right specialist agent.</p>
                <div class="starters">
                  @for (s of starters; track s) {
                    <button class="starter" (click)="ask(s)">{{ s }}</button>
                  }
                </div>
              </div>
            }
            @for (m of messages(); track $index) {
              @if (m.role === 'user') {
                <div class="msg user">{{ m.content }}</div>
              } @else {
                <div class="msg ai">
                  <div [innerHTML]="m.content | markdown"></div>
                  @if (m.streaming) { <span class="stream-cursor"></span> }
                </div>
              }
            }
          </div>

          <div class="foot">
            <asta-composer [disabled]="busy()" placeholder="Message Asta…" (submit)="onComposer($event)" />
          </div>
        </section>
      }
    }
  `,
    styles: [
        `
      /* Sits above the mobile bottom-nav (which is hidden ≥lg). The bottom offset
         clears the ~62px bar + its safe-area inset on phones/tablets, then drops
         back to a tight 22px on desktop where no bottom-nav exists. */
      :host {
        position: fixed;
        right: 22px;
        bottom: calc(76px + env(safe-area-inset-bottom));
        z-index: 70;
      }
      @media (min-width: 1024px) { :host { bottom: 22px; } }
      .orb {
        width: 26px; height: 26px; border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, var(--green), var(--peri) 70%, var(--coral));
        box-shadow: 0 0 0 0 color-mix(in oklch, var(--green) 40%, transparent);
        animation: orbPulse 3s var(--ease) infinite;
        flex: none;
      }
      .orb.sm { width: 20px; height: 20px; }
      .orb.speaking { animation: orbSpeak 0.7s var(--ease) infinite; }
      @keyframes orbPulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--green) 35%, transparent); } 50% { box-shadow: 0 0 0 8px transparent; } }
      @keyframes orbSpeak { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }

      .launcher {
        display: inline-flex; align-items: center; gap: 10px;
        padding: 11px 18px 11px 12px; border-radius: 100px;
        background: var(--ink); color: var(--on-ink); border: 1px solid var(--ink-3);
        box-shadow: var(--shadow-lg); cursor: pointer;
        transition: transform 0.3s var(--ease-spring), box-shadow 0.3s var(--ease), border-color 0.3s var(--ease);
      }
      .launcher:hover {
        transform: translateY(-2px);
        border-color: color-mix(in oklch, var(--green) 45%, var(--ink-3));
        box-shadow: var(--shadow-lg), 0 0 24px var(--asta-accent-glow);
      }
      .launcher:active { transform: scale(0.97); }
      .launcher-label { font-weight: 600; font-size: 14.5px; }

      .panel {
        width: min(390px, calc(100vw - 36px));
        /* Anchored at the host's bottom (raised above the mobile bottom-nav) and
           grows upward — cap height so it never runs off the top of the viewport. */
        height: min(560px, calc(100dvh - 120px - env(safe-area-inset-bottom)));
        display: flex; flex-direction: column;
        /* Glass sheet — same surface family as the modal / toasts / auth card. */
        background:
          radial-gradient(120% 70% at 0% 0%, color-mix(in oklch, var(--paper-2) 55%, transparent), transparent 58%),
          color-mix(in oklch, var(--paper) 92%, transparent);
        border: 1px solid color-mix(in oklch, var(--paper-3) 85%, transparent);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: var(--r-lg); box-shadow: var(--shadow-lg); overflow: hidden;
        animation: dockIn 0.3s var(--ease-spring);
      }
      @keyframes dockIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } }
      .head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 14px; border-bottom: 1px solid var(--paper-3); }
      .head-text { display: flex; flex-direction: column; line-height: 1.2; margin-right: auto; }
      .head-text b { font-family: var(--display); font-size: 16px; }
      .head-text .mono { font-family: var(--mono); font-size: 10.5px; color: var(--text-mute); }
      .hbtn { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 100px; border: 0; background: transparent; color: var(--text-mute); cursor: pointer; }
      .hbtn:hover { color: var(--text); background: var(--paper-2); }
      .hbtn.on { color: var(--green-deep); background: color-mix(in oklch, var(--green) 14%, transparent); }

      .body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .intro { text-align: center; margin: auto 0; }
      .intro-h { font-family: var(--display); font-size: 19px; margin-bottom: 4px; }
      .intro-p { font-size: 13.5px; color: var(--text-soft); margin-bottom: 16px; }
      .starters { display: flex; flex-direction: column; gap: 8px; }
      .starter { font-size: 13px; text-align: left; padding: 9px 12px; border-radius: var(--r-sm); border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: pointer; transition: border-color 0.2s, color 0.2s, transform 0.18s var(--ease-spring); animation: astaRevealUp 0.4s var(--ease) both; }
      .starter:nth-child(2) { animation-delay: 0.06s; }
      .starter:nth-child(3) { animation-delay: 0.12s; }
      .starter:hover { border-color: var(--green); color: var(--text); transform: translateX(3px); }

      .msg { font-size: 14px; line-height: 1.55; max-width: 88%; animation: astaRevealUp 0.3s var(--ease) both; }
      .msg.user { align-self: flex-end; background: linear-gradient(135deg, var(--green-deep), var(--green)); color: var(--ink); padding: 9px 13px; border-radius: 14px 14px 4px 14px; font-weight: 500; box-shadow: 0 4px 16px var(--asta-accent-glow); }
      .msg.ai { align-self: flex-start; color: var(--text-soft); }
      .msg.ai :is(p) { margin: 5px 0; }
      .msg.ai :is(ul, ol) { margin: 5px 0; padding-left: 18px; }
      .msg.ai :is(code) { font-family: var(--mono); background: var(--paper-2); padding: 1px 4px; border-radius: 4px; font-size: 12.5px; }
      .msg.ai :is(strong) { font-weight: 600; color: var(--text); }

      .foot { padding: 10px 12px 12px; border-top: 1px solid var(--paper-3); }
      @media (prefers-reduced-motion: reduce) { .orb, .panel, .launcher, .starter, .msg { animation: none; } .starter:hover { transform: none; } }
    `,
    ]
})
export class AiDockComponent {
  readonly auth = inject(AuthService);
  private readonly agent = inject(AgentService);

  readonly open = signal(this.readOpen());
  readonly busy = signal(false);
  readonly speaking = signal(false);
  readonly readAloud = signal(false);
  readonly messages = signal<DockMsg[]>([]);

  readonly starters = ['Explain closures in JavaScript', 'Quiz me on SQL joins', 'What should I learn next?'];

  private sessionId?: string;

  toggle(): void {
    this.open.update((v) => !v);
    try {
      localStorage.setItem('asta.dock', this.open() ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  toggleReadAloud(): void {
    this.readAloud.update((v) => !v);
    if (!this.readAloud() && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  onComposer(e: ComposerSubmit): void {
    let message = e.text;
    if (e.files.length) {
      const names = e.files.map((f) => f.name).join(', ');
      message = (message ? message + '\n\n' : '') + `(Attached: ${names})`;
    }
    if (message.trim()) this.ask(message);
  }

  ask(text: string): void {
    const message = text.trim();
    if (!message || this.busy()) return;
    this.busy.set(true);
    this.push({ role: 'user', content: message, streaming: false });
    const assistant: DockMsg = { role: 'assistant', content: '', streaming: true };
    this.push(assistant);

    this.agent.stream({ message, sessionId: this.sessionId }).subscribe({
      next: (ev) => this.onEvent(ev, assistant),
      error: () => {
        assistant.streaming = false;
        assistant.content = assistant.content || 'Something went wrong. Please try again.';
        this.bump();
        this.busy.set(false);
      },
    });
  }

  private onEvent(e: AgentStreamEvent, assistant: DockMsg): void {
    switch (e.type) {
      case 'started':
        this.sessionId = e.sessionId;
        break;
      case 'chunk':
        assistant.content += e.delta;
        this.bump();
        break;
      case 'completed':
        assistant.content = e.response.answer;
        assistant.streaming = false;
        this.bump();
        this.busy.set(false);
        this.speak(assistant.content);
        break;
      case 'error':
        assistant.streaming = false;
        assistant.content = assistant.content || e.message;
        this.bump();
        this.busy.set(false);
        break;
      default:
        break;
    }
  }

  private speak(markdown: string): void {
    if (!this.readAloud() || typeof speechSynthesis === 'undefined') return;
    const text = markdown
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/[#*`_>|-]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .slice(0, 600);
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => this.speaking.set(false);
    u.onerror = () => this.speaking.set(false);
    speechSynthesis.cancel();
    this.speaking.set(true);
    speechSynthesis.speak(u);
  }

  private push(m: DockMsg): void {
    this.messages.update((list) => [...list, m]);
  }
  private bump(): void {
    this.messages.update((list) => [...list]);
  }

  private readOpen(): boolean {
    try {
      return localStorage.getItem('asta.dock') === '1';
    } catch {
      return false;
    }
  }
}
