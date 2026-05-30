import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { ToastService } from '../../core/services/toast.service';
import { AgentAction, AgentStreamEvent, VisualBlock, WorkflowStepView } from '../../core/models';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { CardComponent } from '../../shared/ui/card.component';
import { AiAgentActivityFeedComponent } from '../../shared/components/ai/ai-agent-activity-feed.component';
import { VisualBlockRendererComponent } from '../../shared/components/ai/visual-block-renderer.component';
import { ComposerComponent, ComposerSubmit } from '../../shared/ui/composer.component';

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

interface WorkspaceConfig {
  agentType: string;
  title: string;
  subtitle: string;
  avatar: string;
  starters: string[];
}

const DEFAULT: WorkspaceConfig = { agentType: 'tutor', title: 'AI Agent', subtitle: '', avatar: 'A', starters: [] };

/**
 * Generic single-agent streaming workspace. Configured per route via `data` (agentType,
 * subtitle, starters, avatar) so Doubt-solver / Career / Mentor / Content all reuse one
 * chat surface and the shared visual-block renderer + activity feed.
 */
@Component({
  selector: 'asta-agent-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MarkdownPipe, CardComponent, AiAgentActivityFeedComponent, VisualBlockRendererComponent, ComposerComponent],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">{{ cfg().title }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ cfg().subtitle || 'Agent studio · grounded in your learning context' }}</span>
      </div>
    </header>

    <div class="grid gap-5 lg:grid-cols-[1fr_minmax(320px,420px)]" style="min-height:calc(100dvh - 230px)">
      <!-- LEFT: chat -->
      <div class="flex flex-col card" style="padding:0;overflow:hidden">
        <div class="flex items-center gap-3 px-5 py-3.5" style="border-bottom:1px solid var(--asta-line, color-mix(in oklch, var(--paper-3) 60%, transparent))">
          <span class="tutor-orb" [class.busy]="busy()" aria-hidden="true"></span>
          <div class="min-w-0">
            <p class="text-[15px] font-display font-semibold leading-tight">{{ cfg().title }}</p>
            <p class="text-[11px] font-mono text-txt-mute">{{ busy() ? 'Thinking…' : 'Ready' }} · {{ cfg().agentType }}</p>
          </div>
        </div>

        <!-- thread -->
        <div class="flex-1 overflow-y-auto scroll-area px-5 py-5 space-y-5" style="max-height:calc(100dvh - 400px)">
          @if (messages().length === 0) {
            <div class="grid place-items-center text-center py-12">
              <span class="tutor-orb big mb-4" aria-hidden="true"></span>
              <p class="t-h-card mb-1">Ask anything to get started</p>
              <p class="text-txt-soft text-sm mb-5">Or try one of these starters.</p>
              <div class="flex flex-wrap gap-2 justify-center max-w-[520px]">
                @for (s of cfg().starters; track s) { <button class="starter-chip" (click)="send(s)">{{ s }}</button> }
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
                  <p class="font-mono text-[11px] text-txt-mute mb-1">{{ msg.agentType || cfg().agentType }}</p>
                  @if (msg.streaming && !msg.content) {
                    <div class="stream-skeleton" aria-label="Agent is responding">
                      <span class="sk-line" style="width:92%"></span>
                      <span class="sk-line" style="width:78%"></span>
                      <span class="sk-line" style="width:60%"></span>
                    </div>
                  } @else {
                    <div class="prose-asta text-[15px]" [innerHTML]="msg.content | markdown"></div>
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
          <asta-composer
            [disabled]="busy()"
            placeholder="Type a message… (Enter to send · Shift+Enter for a new line)"
            (submit)="onComposer($event)"
          />
        </div>
      </div>

      <!-- RIGHT: agent rail — one reveal family (.motion-row-panel) -->
      <div class="space-y-5 motion-row-panel">
        <div class="motion-card-reveal" style="--motion-card-index:0"><ai-agent-activity-feed [steps]="steps()" [running]="busy()" /></div>

        @if (latestActions().length) {
          <asta-card class="motion-card-reveal" style="--motion-card-index:1" pad="16px 18px">
            <div class="panel-head">
              <p class="kicker">Quick actions</p>
              <span class="panel-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg></span>
            </div>
            <div class="flex flex-wrap gap-2 mt-3">
              @for (a of latestActions(); track a.id) { <button class="act-chip" (click)="runAction(a)">{{ a.label }}</button> }
            </div>
          </asta-card>
        }

        @for (block of latestBlocks(); track $index) {
          <div class="motion-card-reveal" style="--motion-card-index:2"><ai-visual-block [block_]="block" /></div>
        }

        @if (latestRecommended().length) {
          <asta-card class="motion-card-reveal" style="--motion-card-index:3" pad="16px 18px">
            <div class="panel-head">
              <p class="kicker" style="color:var(--green-deep)">Recommended next</p>
              <span class="panel-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
            </div>
            <ul class="space-y-2 text-sm text-txt-soft mt-3">
              @for (r of latestRecommended(); track r) { <li class="rec-item" (click)="send(r)"><span class="arr" style="color:var(--green-deep)">→</span><span>{{ r }}</span></li> }
            </ul>
          </asta-card>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Agent orb — calm conic gradient; spins + glows while the agent thinks. */
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

      .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .panel-ico { width: 32px; height: 32px; flex-shrink: 0; display: grid; place-items: center; border-radius: 10px; color: var(--green-deep); background: color-mix(in oklch, var(--green) 13%, transparent); transition: transform .4s var(--ease-spring); }
      asta-card:hover .panel-ico { transform: scale(1.14) rotate(-8deg); }

      .prose-asta :is(h3) { font-family: var(--display); font-size: 18px; margin: 4px 0 8px; }
      .prose-asta :is(p) { margin: 6px 0; }
      .prose-asta :is(ul, ol) { margin: 6px 0; padding-left: 20px; }
      .prose-asta :is(li) { margin: 3px 0; }
      .prose-asta :is(table) { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
      .prose-asta :is(th, td) { border: 1px solid var(--paper-3); padding: 5px 9px; text-align: left; }
      .prose-asta :is(code) { font-family: var(--mono); background: var(--paper-2); padding: 1px 5px; border-radius: 5px; font-size: 13px; }
      .prose-asta :is(pre) { background: var(--ink); color: var(--on-ink); padding: 12px 14px; border-radius: 12px; overflow:auto; }
      .prose-asta :is(strong) { font-weight: 600; }
    `,
  ],
})
export class AgentWorkspaceComponent implements OnInit {
  private readonly agent = inject(AgentService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly cfg = signal<WorkspaceConfig>(DEFAULT);
  readonly messages = signal<ChatMsg[]>([]);
  readonly steps = signal<WorkflowStepView[]>([]);
  readonly busy = signal(false);

  draft = '';
  private sessionId?: string;
  private lastTopic = '';

  readonly latest = computed(() => {
    const m = this.messages();
    for (let i = m.length - 1; i >= 0; i--) if (m[i].role === 'assistant') return m[i];
    return null;
  });
  readonly latestBlocks = computed(() => this.latest()?.visualBlocks ?? []);
  readonly latestActions = computed(() => this.latest()?.actions ?? []);
  readonly latestRecommended = computed(() => this.latest()?.recommended ?? []);

  ngOnInit(): void {
    // Reset when navigating between agent routes (same component, different data).
    this.route.data.subscribe((data) => {
      this.cfg.set({
        agentType: (data['agentType'] as string) ?? DEFAULT.agentType,
        title: (data['title'] as string) ?? DEFAULT.title,
        subtitle: (data['subtitle'] as string) ?? '',
        avatar: (data['avatar'] as string) ?? 'A',
        starters: (data['starters'] as string[]) ?? [],
      });
      this.messages.set([]);
      this.steps.set([]);
      this.sessionId = undefined;
      this.draft = '';
    });
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
    this.steps.set([]);

    this.push({ role: 'user', content: message, visualBlocks: [], actions: [], followUps: [], recommended: [], streaming: false });
    const assistant: ChatMsg = { role: 'assistant', content: '', visualBlocks: [], actions: [], followUps: [], recommended: [], streaming: true };
    this.push(assistant);

    this.agent.stream({ message, sessionId: this.sessionId, agentType: this.cfg().agentType }).subscribe({
      next: (e) => this.onEvent(e, assistant),
      error: () => {
        assistant.streaming = false;
        assistant.failed = true;
        this.bump();
        this.busy.set(false);
      },
    });
  }

  /** Re-send the last user prompt after a failed response. */
  retry(): void {
    if (this.lastTopic) this.send(this.lastTopic);
  }

  runAction(a: AgentAction): void {
    if (a.kind === 'open_route') {
      const route = a.payload?.['route'] as string | undefined;
      if (route) {
        const queryParams: Record<string, string> = {};
        for (const key of ['quizId', 'projectId']) {
          const v = a.payload?.[key];
          if (typeof v === 'string') queryParams[key] = v;
        }
        this.router.navigate([route], { queryParams });
      }
      return;
    }
    if (a.payload?.['reveal'] === true || a.id === 'reveal') {
      this.send('Show me the fix');
      return;
    }
    const topic = (a.payload?.['topic'] as string) ?? this.lastTopic;
    switch (a.kind) {
      case 'simpler': this.send(`Explain ${topic} in a simpler way`); break;
      case 'ask_interviewer': this.send(`Interview me on ${topic}`); break;
      case 'generate_quiz': this.send(`Quiz me on ${topic}`); break;
      case 'explain_visually': this.send(`Explain ${topic} visually`); break;
      default: this.send(a.label);
    }
  }

  feedback(rating: 'up' | 'down', msg: ChatMsg): void {
    this.agent.sendFeedback(rating, msg.messageId).subscribe({ next: () => this.toast.success('Thanks for the feedback') });
  }

  private onEvent(e: AgentStreamEvent, assistant: ChatMsg): void {
    switch (e.type) {
      case 'started': this.sessionId = e.sessionId; break;
      case 'plan':
        if (e.steps.length > 1) this.steps.update((s) => [...s, { kind: 'tool_call', label: `Plan: ${e.steps.map((p) => p.agentType.replace('_', ' ')).join(' → ')}` }]);
        break;
      case 'step_started':
        if (e.index > 0) this.steps.update((s) => [...s, { kind: 'thinking', label: `Step ${e.index + 1}: ${e.goal}` }]);
        break;
      case 'step_completed': break;
      case 'thinking': this.steps.update((s) => [...s, { kind: 'thinking', label: e.label }]); break;
      case 'tool_call': this.steps.update((s) => [...s, { kind: 'tool_call', label: e.label }]); break;
      case 'tool_result': this.steps.update((s) => [...s, { kind: 'tool_result', label: e.summary }]); break;
      case 'chunk': assistant.content += e.delta; this.bump(); break;
      case 'visual_block': assistant.visualBlocks = [...assistant.visualBlocks, e.block]; this.bump(); break;
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
        break;
      case 'error':
        assistant.streaming = false;
        if (!assistant.content) assistant.failed = true;
        this.bump();
        this.busy.set(false);
        break;
    }
  }

  private push(m: ChatMsg): void {
    this.messages.update((list) => [...list, m]);
  }
  private bump(): void {
    this.messages.update((list) => [...list]);
  }
}
