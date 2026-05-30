import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../core/services/agent.service';
import { ToastService } from '../../core/services/toast.service';
import { AgentAction, AgentStreamEvent, VisualBlock, WorkflowStepView } from '../../core/models';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { ButtonComponent } from '../../shared/ui/button.component';
import { ComposerComponent, ComposerSubmit } from '../../shared/ui/composer.component';
import { AiAgentActivityFeedComponent } from '../../shared/components/ai/ai-agent-activity-feed.component';
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MarkdownPipe, ButtonComponent, ComposerComponent, AiAgentActivityFeedComponent, VisualBlockRendererComponent],
  template: `
    <div class="grid gap-5 lg:grid-cols-[1fr_minmax(320px,420px)]" style="min-height:calc(100vh - 130px)">
      <!-- LEFT: chat -->
      <div class="flex flex-col card" style="padding:0;overflow:hidden">
        <div class="flex items-center justify-between px-5 py-3" style="border-bottom:1px solid var(--paper-3)">
          <div>
            <h2 class="text-[18px] font-display font-semibold">AI Tutor Workspace</h2>
            <p class="text-xs text-txt-mute">Learns from your profile, roadmap & weak areas</p>
          </div>
          <div class="flex flex-wrap gap-1.5 justify-end" style="max-width:60%">
            @for (m of modes; track m) {
              <button class="mode-pill" [class.mode-on]="mode() === m" (click)="mode.set(m)">{{ m }}</button>
            }
          </div>
        </div>

        <!-- thread -->
        <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5" style="max-height:calc(100vh - 320px)">
          @if (messages().length === 0) {
            <div class="text-center py-10">
              <p class="text-txt-soft mb-4">Ask anything — pick a mode, or try a starter.</p>
              <div class="flex flex-wrap gap-2 justify-center">
                @for (s of starters; track s) { <button class="pill" style="cursor:pointer" (click)="send(s)">{{ s }}</button> }
              </div>
            </div>
          }
          @for (msg of messages(); track $index) {
            @if (msg.role === 'user') {
              <div class="flex justify-end">
                <div class="px-4 py-2.5 text-ink" style="background:var(--green);border-radius:16px 16px 4px 16px;max-width:80%">{{ msg.content }}</div>
              </div>
            } @else {
              <div class="flex gap-3">
                <span class="grid place-items-center shrink-0 rounded-[10px] text-ink font-display font-semibold" style="width:32px;height:32px;background:var(--peri)">A</span>
                <div class="min-w-0 flex-1">
                  <p class="font-mono text-[11px] text-txt-mute mb-1">{{ msg.agentType || 'tutor' }} · {{ mode() }}</p>
                  <div class="prose-asta text-[15px]" [innerHTML]="msg.content | markdown"></div>
                  @if (msg.streaming) { <span class="stream-cursor"></span> }
                  @if (!msg.streaming && msg.role === 'assistant') {
                    <div class="flex items-center gap-3 mt-2">
                      <button class="text-txt-mute hover:text-txt" title="Helpful" (click)="feedback('up', msg)">▲</button>
                      <button class="text-txt-mute hover:text-txt" title="Not helpful" (click)="feedback('down', msg)">▼</button>
                      @for (f of msg.followUps.slice(0, 2); track f) {
                        <button class="text-xs pill" style="cursor:pointer" (click)="send(f)">{{ f }}</button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- composer -->
        <div class="px-4 py-3" style="border-top:1px solid var(--paper-3)">
          <asta-composer [disabled]="busy()" placeholder="Ask the tutor… (Enter to send · Shift+Enter for a new line)" (submit)="onComposer($event)" />
        </div>
      </div>

      <!-- RIGHT: visual board + activity + next actions -->
      <div class="space-y-5">
        <ai-agent-activity-feed [steps]="steps()" [running]="busy()" />

        @if (latestActions().length) {
          <div class="card" style="padding:14px 16px">
            <p class="kicker mb-3">Quick actions</p>
            <div class="flex flex-wrap gap-2">
              @for (a of latestActions(); track a.id) {
                <button class="pill" style="cursor:pointer" (click)="runAction(a)">{{ a.label }}</button>
              }
            </div>
          </div>
        }

        @for (block of latestBlocks(); track $index) {
          <ai-visual-block [block_]="block" />
        }

        @if (latestRecommended().length) {
          <div class="card" style="padding:14px 16px">
            <p class="kicker mb-3" style="color:var(--green-deep)">Recommended next</p>
            <ul class="space-y-1.5 text-sm text-txt-soft">
              @for (r of latestRecommended(); track r) { <li class="flex gap-2"><span style="color:var(--green-deep)">→</span>{{ r }}</li> }
            </ul>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .mode-pill { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 4px 10px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); cursor: pointer; }
      .mode-pill:hover { border-color: var(--peri); }
      .mode-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .prose-asta :is(h3) { font-family: var(--display); font-size: 18px; margin: 4px 0 8px; }
      .prose-asta :is(p) { margin: 6px 0; }
      .prose-asta :is(ul, ol) { margin: 6px 0; padding-left: 20px; }
      .prose-asta :is(li) { margin: 3px 0; }
      .prose-asta :is(code) { font-family: var(--mono); background: var(--paper-2); padding: 1px 5px; border-radius: 5px; font-size: 13px; }
      .prose-asta :is(pre) { background: var(--ink); color: var(--on-ink); padding: 12px 14px; border-radius: 12px; overflow:auto; }
      .prose-asta :is(strong) { font-weight: 600; }
    `,
  ],
})
export class TutorWorkspaceComponent {
  private readonly agent = inject(AgentService);
  private readonly toast = inject(ToastService);

  readonly modes = MODES;
  readonly starters = STARTERS;
  readonly mode = signal<Mode>('explain');
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
    this.steps.set([]);

    this.push({ role: 'user', content: message, visualBlocks: [], actions: [], followUps: [], recommended: [], streaming: false });
    const assistant: ChatMsg = { role: 'assistant', content: '', visualBlocks: [], actions: [], followUps: [], recommended: [], streaming: true };
    this.push(assistant);

    this.agent.stream({ message, sessionId: this.sessionId, mode: this.mode() }).subscribe({
      next: (e) => this.onEvent(e, assistant),
      error: () => {
        assistant.streaming = false;
        assistant.content = assistant.content || 'Something went wrong. Please try again.';
        this.bump();
        this.busy.set(false);
      },
    });
  }

  runAction(a: AgentAction): void {
    const topic = (a.payload?.['topic'] as string) ?? this.lastTopic;
    switch (a.kind) {
      case 'explain_visually': this.mode.set('visual'); this.send(`Explain ${topic} visually`); break;
      case 'simpler': this.send(`Explain ${topic} in a simpler way`); break;
      case 'ask_interviewer': this.mode.set('interview'); this.send(`Interview me on ${topic}`); break;
      case 'generate_quiz': this.mode.set('practice'); this.send(`Quiz me on ${topic}`); break;
      case 'generate_notes': this.send(`Generate concise notes on ${topic}`); break;
      case 'open_route': /* handled by router elsewhere */ break;
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
        break;
      case 'error':
        assistant.streaming = false;
        assistant.content = assistant.content || e.message;
        this.bump();
        this.busy.set(false);
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
