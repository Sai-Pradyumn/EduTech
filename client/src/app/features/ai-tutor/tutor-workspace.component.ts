import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { ToastService } from '../../core/services/toast.service';
import { AgentAction, AgentSessionSummary, AgentStreamEvent, VisualBlock, WorkflowStepView } from '../../core/models';
import { RichContentComponent } from '../../shared/components/ai/rich-content.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { ComposerComponent, ComposerSubmit } from '../../shared/ui/composer.component';
import { AiAgentActivityFeedComponent } from '../../shared/components/ai/asta-ai-agent-activity-feed.component';
import { VisualBlockRendererComponent } from '../../shared/components/ai/visual-block-renderer.component';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  agentType?: string;
  visualBlocks: VisualBlock[];
  actions: AgentAction[];
  followUps: string[];
  recommended: string[];
  streaming: boolean;
  failed?: boolean;
  messageId?: string;
}

const MODES = ['explain', 'socratic', 'hint', 'practice', 'interview', 'visual', 'revision', 'debugging'] as const;
type Mode = (typeof MODES)[number];

const STARTERS = [
  'Explain closures in JavaScript',
  'What is Big O notation?',
  'Teach me recursion with an analogy',
  'Review my progress and plan my week',
];

@Component({
    selector: 'asta-tutor-workspace',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichContentComponent, ButtonComponent, CardComponent, ComposerComponent, AiAgentActivityFeedComponent, VisualBlockRendererComponent],
    template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">AI Tutor</h1>
        <span class="goal-pill"><span class="dot"></span>Cognitive studio · learns from your weak areas</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        @if (messages().length) { <asta-btn variant="ghost" size="sm" (click)="newChat()">New chat</asta-btn> }
      </div>
    </header>

    <!-- Screen-reader-only status for streaming AI replies (a11y). -->
    <span class="sr-only" aria-live="polite" role="status">{{ liveStatus() }}</span>

    <div class="grid gap-5 lg:grid-cols-[1fr_minmax(320px,400px)]" [class.maximized]="expanded()"
      [style.minHeight]="expanded() ? null : 'calc(100dvh - 230px)'">
      <!-- LEFT: chat -->
      <div class="flex flex-col card" style="padding:0;overflow:hidden">
        <div class="flex items-center justify-between gap-3 px-5 py-3.5" style="border-bottom:1px solid var(--asta-line, color-mix(in oklch, var(--paper-3) 60%, transparent))">
          <div class="flex items-center gap-3 min-w-0">
            <span class="tutor-orb" [class.busy]="busy()" aria-hidden="true"></span>
            <div class="min-w-0">
              <p class="text-[15px] font-display font-semibold leading-tight">Asta Tutor</p>
              <p class="text-[11px] font-mono text-txt-mute">{{ busy() ? 'Thinking…' : 'Ready' }} · {{ mode() }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="flex flex-wrap gap-1.5 justify-end">
              @for (m of modes; track m) {
                <button class="mode-pill" [class.mode-on]="mode() === m" (click)="mode.set(m)">{{ m }}</button>
              }
            </div>
            <button class="hdr-btn" [class.hdr-on]="showHistory()" title="Past chats" (click)="toggleHistory()" aria-label="Past chats">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>
            </button>
            <button class="hdr-btn" [title]="expanded() ? 'Exit large view (Esc)' : 'Large view'" (click)="expanded.set(!expanded())" [attr.aria-label]="expanded() ? 'Exit large view' : 'Large view'">
              @if (expanded()) {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              } @else {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              }
            </button>
          </div>
        </div>

        <!-- past chats -->
        @if (showHistory()) {
          <div class="hist-panel">
            @if (historyLoading()) {
              <p class="text-[13px] text-txt-mute px-1 py-2">Loading your chats…</p>
            } @else if (history().length === 0) {
              <p class="text-[13px] text-txt-mute px-1 py-2">No past chats yet — everything you discuss is saved here.</p>
            } @else {
              @for (s of history(); track s.id) {
                <button class="hist-row" (click)="openSession(s)">
                  <span class="truncate">{{ s.title || 'Untitled chat' }}</span>
                  <span class="hist-when">{{ sessionWhen(s) }}</span>
                </button>
              }
            }
          </div>
        }

        <!-- thread -->
        <div class="flex-1 overflow-y-auto scroll-area px-5 py-5 space-y-5"
          [style.maxHeight]="expanded() ? 'none' : 'calc(100dvh - 400px)'">
          @if (messages().length === 0) {
            <div class="grid place-items-center text-center py-12">
              <span class="tutor-orb big mb-4" aria-hidden="true"></span>
              <p class="t-h-card mb-1">How can I help you learn?</p>
              <p class="text-txt-soft text-sm mb-5">Pick a mode, or start with one of these.</p>
              <div class="flex flex-wrap gap-2 justify-center max-w-[520px]">
                @for (s of starters; track s) { <button class="starter-chip" (click)="send(s)">{{ s }}</button> }
              </div>
            </div>
          }
          @for (msg of messages(); track $index) {
            @if (msg.role === 'user') {
              <div class="flex justify-end motion-fade-up">
                <div class="user-bubble">{{ msg.content }}</div>
              </div>
            } @else {
              <div class="flex gap-3 motion-fade-up">
                <span class="msg-orb shrink-0" [class.busy]="msg.streaming" aria-hidden="true"></span>
                <div class="min-w-0 flex-1">
                  <p class="font-mono text-[11px] text-txt-mute mb-1">{{ msg.agentType || 'tutor' }} · {{ mode() }}</p>
                  @if (msg.streaming && !msg.content) {
                    <div class="stream-skeleton" aria-label="Tutor is responding">
                      <span class="sk-line" style="width:92%"></span>
                      <span class="sk-line" style="width:78%"></span>
                      <span class="sk-line" style="width:60%"></span>
                    </div>
                  } @else {
                    <asta-rich-content class="text-[15px]" [text]="msg.content" [streaming]="!!msg.streaming" />
                  }
                  @if (msg.streaming && msg.content) { <span class="stream-cursor"></span> }
                  @if (msg.failed) {
                    <div class="err-row mt-2.5">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
                      <span>That response didn't complete.</span>
                      <button class="retry-btn" (click)="retry()">Retry</button>
                    </div>
                  }
                  @if (!msg.streaming && !msg.failed && msg.role === 'assistant') {
                    <div class="flex items-center flex-wrap gap-2 mt-2.5">
                      <button class="fb-btn" title="Helpful" (click)="feedback('up', msg)">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                      </button>
                      <button class="fb-btn" title="Not helpful" (click)="feedback('down', msg)">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(180deg)"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                      </button>
                      @for (f of msg.followUps.slice(0, 2); track f) {
                        <button class="starter-chip sm" (click)="send(f)">{{ f }}</button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- composer -->
        <div class="px-4 py-3" style="border-top:1px solid color-mix(in oklch, var(--paper-3) 60%, transparent)">
          <asta-composer [disabled]="busy()" placeholder="Ask the tutor… (Enter to send · Shift+Enter for a new line)" (submit)="onComposer($event)" />
        </div>
      </div>

      <!-- RIGHT: agent rail — one reveal family (.motion-row-panel) -->
      <div class="space-y-5 motion-row-panel">
        <div class="motion-card-reveal" style="--motion-card-index:0"><asta-ai-agent-activity-feed [steps]="steps()" [running]="busy()" /></div>

        @if (latestActions().length) {
          <asta-card class="motion-card-reveal" style="--motion-card-index:1" pad="16px 18px">
            <div class="panel-head">
              <p class="kicker">Quick actions</p>
              <span class="panel-ico green" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg></span>
            </div>
            <div class="flex flex-wrap gap-2 mt-3">
              @for (a of latestActions(); track a.id) { <button class="act-chip" (click)="runAction(a)">{{ a.label }}</button> }
            </div>
          </asta-card>
        }

        @for (block of latestBlocks(); track $index) {
          <div class="motion-card-reveal" style="--motion-card-index:2"><asta-ai-visual-block [block_]="block" /></div>
        }

        @if (latestRecommended().length) {
          <asta-card class="motion-card-reveal" style="--motion-card-index:3" pad="16px 18px">
            <div class="panel-head">
              <p class="kicker" style="color:var(--green-deep)">Recommended next</p>
              <span class="panel-ico green" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
            </div>
            <ul class="space-y-2 text-sm text-txt-soft mt-3">
              @for (r of latestRecommended(); track r) { <li class="rec-item" role="button" tabindex="0" (click)="send(r)" (keyup.enter)="send(r)"><span class="arr" style="color:var(--green-deep)">→</span><span>{{ r }}</span></li> }
            </ul>
          </asta-card>
        }
      </div>
    </div>
  `,
    styles: [
        `
      /* Agent orb — calm conic gradient; spins + glows while the tutor thinks. */
      .tutor-orb, .msg-orb {
        border-radius: 999px;
        background:
          radial-gradient(circle at 34% 28%, #fff, transparent 26%),
          conic-gradient(from 140deg, var(--green), var(--asta-cyan), var(--peri), var(--green));
        box-shadow: 0 0 16px var(--asta-accent-glow);
      }
      .tutor-orb { width: 34px; height: 34px; }
      .tutor-orb.big { width: 64px; height: 64px; box-shadow: 0 0 28px var(--asta-accent-glow), 0 0 60px var(--asta-glow-cyan); animation: astaOrbitSpin 18s linear infinite; }
      .msg-orb { width: 30px; height: 30px; }
      .tutor-orb.busy, .msg-orb.busy { animation: astaOrbitSpin 3s linear infinite; }

      .mode-pill { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 5px 11px; border-radius: 999px; border: 1px solid color-mix(in oklch, var(--paper-3) 60%, transparent); background: color-mix(in oklch, var(--paper-2) 50%, transparent); color: var(--text-soft); cursor: pointer; transition: transform .18s var(--ease-spring), border-color .18s var(--ease), color .18s var(--ease), background .18s var(--ease); }
      .mode-pill:hover { color: var(--text); border-color: color-mix(in oklch, var(--green) 35%, transparent); transform: translateY(-1px); }
      .mode-on { background: linear-gradient(135deg, var(--green), var(--green-deep)); color: #06100a; border-color: transparent; box-shadow: 0 6px 16px var(--asta-accent-glow); }

      .user-bubble { padding: 10px 15px; color: #06100a; max-width: 80%; border-radius: 16px 16px 4px 16px; background: linear-gradient(135deg, var(--green), var(--green-deep)); box-shadow: 0 8px 22px var(--asta-accent-glow); }

      .starter-chip { font-size: 13.5px; padding: 8px 14px; border-radius: 999px; border: 1px solid color-mix(in oklch, var(--paper-3) 60%, transparent); background: color-mix(in oklch, var(--paper-2) 50%, transparent); color: var(--text-soft); cursor: pointer; transition: transform .18s var(--ease-spring), border-color .18s var(--ease), color .18s var(--ease); }
      .starter-chip.sm { font-size: 12px; padding: 5px 11px; }
      .starter-chip:hover { transform: translateY(-2px); color: var(--text); border-color: color-mix(in oklch, var(--green) 40%, transparent); }

      .act-chip { font-family: var(--mono); font-size: 12px; padding: 7px 12px; border-radius: 999px; border: 1px solid color-mix(in oklch, var(--paper-3) 60%, transparent); background: transparent; color: var(--text-soft); cursor: pointer; transition: transform .16s var(--ease-spring), background .16s var(--ease), color .16s var(--ease); }
      .act-chip:hover { background: var(--asta-accent-glow); color: var(--text); transform: translateY(-1px); }

      .fb-btn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: var(--text-mute); transition: color .15s var(--ease), background .15s var(--ease), transform .12s var(--ease-spring); }
      .fb-btn:hover { color: var(--green-deep); background: var(--asta-accent-glow); transform: translateY(-1px); }

      /* Streaming skeleton — shown before the first chunk arrives. */
      .stream-skeleton { display: flex; flex-direction: column; gap: 8px; padding: 2px 0; }
      .sk-line { height: 11px; border-radius: 6px; background: linear-gradient(100deg, color-mix(in oklch, var(--paper-3) 55%, transparent) 30%, color-mix(in oklch, var(--green) 16%, transparent) 50%, color-mix(in oklch, var(--paper-3) 55%, transparent) 70%); background-size: 220% 100%; animation: skShimmer 1.4s ease infinite; }
      @keyframes skShimmer { 0% { background-position: 180% 0; } 100% { background-position: -40% 0; } }

      /* Error + retry row. */
      .err-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-soft); }
      .err-row svg { color: #e0654f; flex-shrink: 0; }
      .retry-btn { font-family: var(--mono); font-size: 12px; padding: 4px 12px; border-radius: 999px; border: 1px solid color-mix(in oklch, var(--green) 38%, transparent); background: var(--asta-accent-glow); color: var(--green-deep); cursor: pointer; transition: transform .14s var(--ease-spring), background .14s var(--ease); }
      .retry-btn:hover { transform: translateY(-1px); background: color-mix(in oklch, var(--green) 22%, transparent); }

      .rec-item { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; padding: 4px 6px; margin: 0 -6px; border-radius: 8px; transition: background .16s var(--ease), color .16s var(--ease); }
      .rec-item:hover { background: color-mix(in oklch, var(--paper-2) 55%, transparent); color: var(--text); }

      /* Large view: the whole workspace takes over the viewport (Esc to exit). */
      .maximized { position: fixed; inset: 0; z-index: 80; background: var(--paper); padding: 16px 18px; overflow: auto; margin: 0; }

      .hdr-btn { display: grid; place-items: center; width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px; color: var(--text-mute); border: 1px solid transparent; cursor: pointer; transition: color .15s var(--ease), background .15s var(--ease); }
      .hdr-btn:hover, .hdr-btn.hdr-on { color: var(--green-deep); background: var(--asta-accent-glow); }

      .hist-panel { max-height: 260px; overflow-y: auto; padding: 8px 12px; border-bottom: 1px solid color-mix(in oklch, var(--paper-3) 60%, transparent); background: color-mix(in oklch, var(--paper-2) 40%, transparent); }
      .hist-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; text-align: left; font-size: 13.5px; padding: 8px 10px; border-radius: 9px; color: var(--text-soft); cursor: pointer; transition: background .14s var(--ease), color .14s var(--ease); }
      .hist-row:hover { background: color-mix(in oklch, var(--paper-2) 80%, transparent); color: var(--text); }
      .hist-when { font-family: var(--mono); font-size: 11px; color: var(--text-mute); flex-shrink: 0; }

      .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .panel-ico { width: 32px; height: 32px; flex-shrink: 0; display: grid; place-items: center; border-radius: 10px; color: var(--green-deep); background: color-mix(in oklch, var(--green) 13%, transparent); transition: transform .4s var(--ease-spring); }
      asta-card:hover .panel-ico { transform: scale(1.14) rotate(-8deg); }

      .prose-asta :is(h3) { font-family: var(--display); font-size: 18px; margin: 4px 0 8px; }
      .prose-asta :is(p) { margin: 6px 0; }
      .prose-asta :is(ul, ol) { margin: 6px 0; padding-left: 20px; }
      .prose-asta :is(li) { margin: 3px 0; }
      .prose-asta :is(code) { font-family: var(--mono); background: var(--paper-2); padding: 1px 5px; border-radius: 5px; font-size: 13px; }
      .prose-asta :is(pre) { background: var(--ink); color: var(--on-ink); padding: 12px 14px; border-radius: 12px; overflow:auto; }
      .prose-asta :is(strong) { font-weight: 600; }
    `,
    ]
})
export class TutorWorkspaceComponent {
  private readonly agent = inject(AgentService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly modes = MODES;
  readonly starters = STARTERS;
  readonly mode = signal<Mode>('explain');
  readonly messages = signal<ChatMsg[]>([]);
  readonly steps = signal<WorkflowStepView[]>([]);
  readonly busy = signal(false);
  /** Polite screen-reader status for streaming tutor replies (no visual footprint). */
  readonly liveStatus = signal('');
  /** Large view: the workspace takes over the viewport (Esc exits). */
  readonly expanded = signal(false);
  readonly history = signal<AgentSessionSummary[]>([]);
  readonly showHistory = signal(false);
  readonly historyLoading = signal(false);

  draft = '';
  private sessionId?: string;
  private lastTopic = '';

  constructor() {
    // Deep links (e.g. a roadmap week's "Learn with Tutor"): ?topic=X&mode=practice
    // pre-focuses the session and starts it on that topic immediately.
    const qp = this.route.snapshot.queryParamMap;
    const mode = qp.get('mode');
    if (mode && (MODES as readonly string[]).includes(mode)) this.mode.set(mode as Mode);
    const topic = qp.get('topic')?.trim();
    if (topic) {
      setTimeout(() => this.send(this.topicPrompt(topic)));
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  private topicPrompt(topic: string): string {
    switch (this.mode()) {
      case 'practice': return `Quiz me on ${topic}`;
      case 'interview': return `Interview me on ${topic}`;
      case 'visual': return `Explain ${topic} visually`;
      case 'revision': return `Help me revise ${topic}`;
      default: return `Teach me ${topic} — connect it to my roadmap and my weak areas`;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.expanded()) this.expanded.set(false);
  }

  /** Reset the conversation for a fresh session. */
  newChat(): void {
    this.messages.set([]);
    this.steps.set([]);
    this.sessionId = undefined;
    this.lastTopic = '';
  }

  // ── Past chats: every session is saved server-side; resume any of them. ──

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
    if (this.showHistory() && this.history().length === 0) {
      this.historyLoading.set(true);
      this.agent.listSessions().subscribe({
        next: (list) => {
          this.history.set(list);
          this.historyLoading.set(false);
        },
        error: () => this.historyLoading.set(false),
      });
    }
  }

  openSession(s: AgentSessionSummary): void {
    this.historyLoading.set(true);
    this.agent.getMessages(s.id).subscribe({
      next: (msgs) => {
        this.messages.set(
          msgs.map((m) => ({
            role: m.role,
            content: m.content,
            agentType: m.agentType,
            visualBlocks: m.visualBlocks ?? [],
            actions: m.actions ?? [],
            followUps: m.followUpQuestions ?? [],
            recommended: m.recommendedNextActions ?? [],
            streaming: false,
            messageId: m.id,
          })),
        );
        this.sessionId = s.id; // continue the thread where it left off
        this.steps.set([]);
        this.showHistory.set(false);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyLoading.set(false);
        this.toast.error('Could not load that chat');
      },
    });
  }

  sessionWhen(s: AgentSessionSummary): string {
    if (!s.lastMessageAt) return '';
    const ms = Date.now() - new Date(s.lastMessageAt).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return mins < 1 ? 'now' : `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(s.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  readonly latest = computed(() => {
    const m = this.messages();
    for (let i = m.length - 1; i >= 0; i--) if (m[i].role === 'assistant') return m[i];
    return null;
  });
  readonly latestBlocks = computed(() => this.latest()?.visualBlocks ?? []);
  readonly latestActions = computed(() => this.latest()?.actions ?? []);
  readonly latestRecommended = computed(() => this.latest()?.recommended ?? []);

  onEnter(ev: Event): void {
    ev.preventDefault();
    if (this.draft.trim()) this.send(this.draft);
  }

  onComposer(e: ComposerSubmit): void {
    let message = e.text;
    if (e.files.length) {
      const names = e.files.map((f) => f.name).join(', ');
      message = (message ? message + '\n\n' : '') + `(Attached: ${names})`;
    }
    if (message.trim()) this.send(message);
  }

  send(text: string): void {
    const message = text.trim();
    if (!message || this.busy()) return;
    this.lastTopic = message;
    this.draft = '';
    this.busy.set(true);
    this.liveStatus.set('Asta is responding…');
    this.steps.set([]);

    this.push({ role: 'user', content: message, visualBlocks: [], actions: [], followUps: [], recommended: [], streaming: false });
    const assistant: ChatMsg = { role: 'assistant', content: '', visualBlocks: [], actions: [], followUps: [], recommended: [], streaming: true };
    this.push(assistant);

    this.agent.stream({ message, sessionId: this.sessionId, mode: this.mode() }).subscribe({
      next: (e) => this.onEvent(e, assistant),
      error: () => {
        assistant.streaming = false;
        assistant.failed = true;
        this.bump();
        this.busy.set(false);
        this.liveStatus.set('The response failed.');
      },
    });
  }

  /** Re-send the last user prompt after a failed response. */
  retry(): void {
    if (this.lastTopic) this.send(this.lastTopic);
  }

  runAction(a: AgentAction): void {
    const topic = (a.payload?.['topic'] as string) ?? this.lastTopic;
    switch (a.kind) {
      case 'explain_visually': this.mode.set('visual'); this.send(`Explain ${topic} visually`); break;
      case 'simpler': this.send(`Explain ${topic} in a simpler way`); break;
      case 'ask_interviewer': this.mode.set('interview'); this.send(`Interview me on ${topic}`); break;
      case 'generate_quiz': this.mode.set('practice'); this.send(`Quiz me on ${topic}`); break;
      case 'generate_notes': this.send(`Generate concise notes on ${topic}`); break;
      case 'open_route': {
        const route = a.payload?.['route'] as string | undefined;
        if (route) void this.router.navigateByUrl(route);
        break;
      }
      default: this.send(`${a.label}: ${topic}`);
    }
  }

  feedback(rating: 'up' | 'down', msg: ChatMsg): void {
    this.agent.sendFeedback(rating, msg.messageId).subscribe({ next: () => this.toast.success('Thanks for the feedback') });
  }

  private onEvent(e: AgentStreamEvent, assistant: ChatMsg): void {
    switch (e.type) {
      case 'started':
        this.sessionId = e.sessionId;
        break;
      case 'plan':
        if (e.steps.length > 1) {
          this.steps.update((s) => [
            ...s,
            { kind: 'tool_call', label: `Plan: ${e.steps.map((p) => p.agentType.replace('_', ' ')).join(' → ')}` },
          ]);
        }
        break;
      case 'step_started':
        if (e.index > 0) {
          this.steps.update((s) => [...s, { kind: 'thinking', label: `Step ${e.index + 1}: ${e.goal}` }]);
        }
        break;
      case 'step_completed':
        break;
      case 'thinking':
        this.steps.update((s) => [...s, { kind: 'thinking', label: e.label }]);
        break;
      case 'tool_call':
        this.steps.update((s) => [...s, { kind: 'tool_call', label: e.label }]);
        break;
      case 'tool_result':
        this.steps.update((s) => [...s, { kind: 'tool_result', label: e.summary }]);
        break;
      case 'chunk':
        assistant.content += e.delta;
        this.bump();
        break;
      case 'visual_block':
        assistant.visualBlocks = [...assistant.visualBlocks, e.block];
        this.bump();
        break;
      case 'completed':
        assistant.content = e.response.answer;
        assistant.visualBlocks = e.response.visualBlocks;
        assistant.actions = e.response.actions;
        assistant.followUps = e.response.followUpQuestions;
        assistant.recommended = e.response.recommendedNextActions;
        assistant.agentType = e.response.agentType;
        assistant.streaming = false;
        assistant.messageId = e.messageId;
        this.steps.update((s) => [...s, { kind: 'done', label: 'Done' }]);
        this.bump();
        this.busy.set(false);
        this.liveStatus.set('Response ready.');
        break;
      case 'error':
        assistant.streaming = false;
        if (!assistant.content) assistant.failed = true;
        this.bump();
        this.busy.set(false);
        this.liveStatus.set('The response failed.');
        break;
    }
  }

  private push(m: ChatMsg): void {
    this.messages.update((list) => [...list, m]);
  }
  /** Trigger change detection for in-place mutations on the streaming message. */
  private bump(): void {
    this.messages.update((list) => [...list]);
  }
}
