import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../core/services/agent.service';
import { KnowledgeService } from '../../core/services/knowledge.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AgentStreamEvent,
  DocumentSummary,
  Flashcard,
  KnowledgeDoc,
  SourceReference,
  VisualBlock,
  WorkflowStepView,
} from '../../core/models';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { ButtonComponent } from '../../shared/ui/button.component';
import { ComposerComponent, ComposerSubmit } from '../../shared/ui/composer.component';
import { AiAgentActivityFeedComponent } from '../../shared/components/ai/ai-agent-activity-feed.component';
import { VisualBlockRendererComponent } from '../../shared/components/ai/visual-block-renderer.component';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  sources: SourceReference[];
  visualBlocks: VisualBlock[];
  followUps: string[];
  confidence: number;
  streaming: boolean;
  messageId?: string;
}

const STARTERS = [
  'Summarize the key ideas',
  'What are the main takeaways?',
  'Explain the hardest concept here simply',
];

@Component({
  selector: 'asta-knowledge-hub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MarkdownPipe, ButtonComponent, ComposerComponent, AiAgentActivityFeedComponent, VisualBlockRendererComponent],
  template: `
    <div class="grid gap-5 lg:grid-cols-[minmax(300px,360px)_1fr]" style="min-height:calc(100vh - 130px)">
      <!-- LEFT: upload + library -->
      <div class="space-y-5">
        <div class="card" style="padding:16px">
          <p class="kicker mb-3">Add to your knowledge base</p>
          <div class="drop" [class.drop-over]="dragOver()"
            (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
            <input #fileInput type="file" class="hidden" accept=".txt,.md,.markdown,.json,.pdf,.docx,text/*"
              (change)="onFilePicked($event)" />
            <p class="text-sm text-txt-soft mb-2">Drop a file or</p>
            <asta-btn variant="ghost" size="sm" (click)="fileInput.click()" [disabled]="uploading()">Choose file</asta-btn>
            <p class="text-[11px] text-txt-mute mt-2">.txt .md .json · .pdf/.docx if supported · ≤ 10 MB</p>
          </div>
          <button class="text-xs font-semibold mt-3" style="color:var(--green-deep)" (click)="pasteMode.set(!pasteMode())">
            {{ pasteMode() ? '— Hide paste' : '+ Paste text instead' }}
          </button>
          @if (pasteMode()) {
            <div class="mt-3 space-y-2">
              <input class="input" placeholder="Title" [(ngModel)]="pasteTitle" />
              <textarea class="input" rows="5" placeholder="Paste your notes…" [(ngModel)]="pasteBody"></textarea>
              <asta-btn variant="accent" size="sm" [loading]="uploading()" [disabled]="!pasteTitle.trim() || !pasteBody.trim()"
                (click)="submitText()">Add document</asta-btn>
            </div>
          }
        </div>

        <div class="card" style="padding:16px">
          <div class="flex items-center justify-between mb-3">
            <p class="kicker">Your documents</p>
            <button class="text-xs text-txt-mute hover:text-txt" (click)="refresh()">Refresh</button>
          </div>
          @if (docs().length === 0) {
            <p class="text-sm text-txt-mute py-6 text-center">No documents yet. Add one above to start asking grounded questions.</p>
          }
          <div class="space-y-2.5">
            @for (d of docs(); track d.id) {
              <div class="doc" [class.doc-on]="isSelected(d.id)">
                <div class="flex items-start gap-2">
                  <input type="checkbox" class="mt-1" [checked]="isSelected(d.id)" [disabled]="d.status !== 'ready'"
                    (change)="toggleSelect(d.id)" />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium truncate">{{ d.title }}</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="status" [attr.data-s]="d.status">{{ statusLabel(d) }}</span>
                      @if (d.status === 'ready') { <span class="text-[11px] text-txt-mute">{{ d.chunkCount }} chunks</span> }
                    </div>
                    @if (d.tags.length) {
                      <div class="flex flex-wrap gap-1 mt-1.5">@for (t of d.tags.slice(0,4); track t) { <span class="tag">{{ t }}</span> }</div>
                    }
                    @if (d.status === 'failed' && d.error) { <p class="text-[11px] mt-1" style="color:var(--coral-deep)">{{ d.error }}</p> }
                    @if (d.warnings.length) { <p class="text-[11px] mt-1 text-txt-mute">⚠ {{ d.warnings[0] }}</p> }
                    @if (d.status === 'ready') {
                      <div class="flex gap-2 mt-2">
                        <button class="mini" (click)="loadSummary(d)">Summary</button>
                        <button class="mini" (click)="loadFlashcards(d)">Flashcards</button>
                        <button class="mini" style="color:var(--coral-deep)" (click)="remove(d)">Delete</button>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- RIGHT: grounded chat -->
      <div class="flex flex-col card" style="padding:0;overflow:hidden">
        <div class="flex items-center justify-between px-5 py-3" style="border-bottom:1px solid var(--paper-3)">
          <div>
            <h2 class="text-[18px] font-display font-semibold">Knowledge Hub</h2>
            <p class="text-xs text-txt-mute">Grounded answers with citations — {{ scopeLabel() }}</p>
          </div>
        </div>

        @if (panel(); as p) {
          <div class="px-5 py-3" style="border-bottom:1px solid var(--paper-3);background:var(--paper-2)">
            <div class="flex items-center justify-between mb-2">
              <p class="kicker">{{ p.title }}</p>
              <button class="text-xs text-txt-mute hover:text-txt" (click)="panel.set(null)">Close</button>
            </div>
            @if (p.summary) {
              <p class="text-sm mb-2">{{ p.summary.tldr }}</p>
              <ul class="text-sm text-txt-soft space-y-1">@for (k of p.summary.keyPoints; track $index) { <li class="flex gap-2"><span style="color:var(--green-deep)">•</span>{{ k }}</li> }</ul>
            }
            @if (p.cards) {
              <div class="grid sm:grid-cols-2 gap-2">
                @for (c of p.cards; track $index) {
                  <div class="rounded-[10px] p-2.5" style="background:var(--paper);border:1px solid var(--paper-3)">
                    <p class="text-[13px] font-medium">{{ c.question }}</p>
                    <p class="text-[13px] text-txt-soft mt-1">{{ c.answer }}</p>
                    <p class="text-[10px] text-txt-mute mt-1 font-mono">{{ c.source }}</p>
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5" style="max-height:calc(100vh - 360px)">
          @if (messages().length === 0) {
            <div class="text-center py-10">
              <p class="text-txt-soft mb-4">Ask a question grounded in your documents. I cite every claim and say "I don't know" when your docs don't cover it.</p>
              <div class="flex flex-wrap gap-2 justify-center">
                @for (s of starters; track s) { <button class="pill" style="cursor:pointer" (click)="send(s)" [disabled]="!canAsk()">{{ s }}</button> }
              </div>
              @if (!canAsk()) { <p class="text-xs text-txt-mute mt-3">Add a document first (and wait for it to be “ready”).</p> }
            </div>
          }
          @for (msg of messages(); track $index) {
            @if (msg.role === 'user') {
              <div class="flex justify-end">
                <div class="px-4 py-2.5 text-ink" style="background:var(--green);border-radius:16px 16px 4px 16px;max-width:80%">{{ msg.content }}</div>
              </div>
            } @else {
              <div class="flex gap-3">
                <span class="grid place-items-center shrink-0 rounded-[10px] text-ink font-display font-semibold" style="width:32px;height:32px;background:var(--peri)">R</span>
                <div class="min-w-0 flex-1">
                  <p class="font-mono text-[11px] text-txt-mute mb-1">
                    rag
                    @if (!msg.streaming) { · <span [style.color]="confColor(msg.confidence)">{{ confLabel(msg.confidence) }} · {{ pct(msg.confidence) }}%</span> }
                  </p>
                  <div class="prose-asta text-[15px]" [innerHTML]="msg.content | markdown"></div>
                  @if (msg.streaming) { <span class="stream-cursor"></span> }
                  @if (!msg.streaming && msg.sources.length) {
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      @for (s of msg.sources; track $index) {
                        <span class="cite" [title]="s.snippet">{{ $index + 1 }} · {{ s.title }}</span>
                      }
                    </div>
                  }
                  @if (!msg.streaming && msg.role === 'assistant') {
                    <div class="flex items-center gap-3 mt-2">
                      <button class="text-txt-mute hover:text-txt" title="Helpful" (click)="feedback('up', msg)">▲</button>
                      <button class="text-txt-mute hover:text-txt" title="Not helpful" (click)="feedback('down', msg)">▼</button>
                      @for (f of msg.followUps.slice(0, 2); track f) {
                        <button class="text-xs pill" style="cursor:pointer" (click)="send(f)">{{ f }}</button>
                      }
                    </div>
                  }
                  @for (block of msg.visualBlocks; track $index) {
                    <div class="mt-3"><ai-visual-block [block_]="block" /></div>
                  }
                </div>
              </div>
            }
          }
          @if (busy()) { <ai-agent-activity-feed [steps]="steps()" [running]="busy()" /> }
        </div>

        <div class="px-4 py-3" style="border-top:1px solid var(--paper-3)">
          <asta-composer [disabled]="busy() || !canAsk()" placeholder="Ask your documents… (Enter to send · Shift+Enter for a new line)" (submit)="onComposer($event)" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .drop { border: 1.5px dashed var(--paper-3); border-radius: 14px; padding: 20px; text-align: center; transition: all .15s; }
      .drop-over { border-color: var(--green); background: oklch(0.80 0.16 150 / .08); }
      .hidden { display: none; }
      .doc { border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 12px; transition: border-color .15s; }
      .doc-on { border-color: var(--green); background: oklch(0.80 0.16 150 / .06); }
      .status { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 1px 7px; border-radius: 100px; background: var(--paper-2); color: var(--text-soft); }
      .status[data-s='ready'] { background: oklch(0.80 0.16 150 / .18); color: var(--green-deep); }
      .status[data-s='failed'] { background: oklch(0.72 0.17 25 / .16); color: var(--coral-deep); }
      .tag { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: var(--paper-2); color: var(--text-mute); }
      .mini { font-size: 11px; font-weight: 600; color: var(--text-soft); }
      .mini:hover { color: var(--text); }
      .cite { font-family: var(--mono); font-size: 11px; padding: 2px 8px; border-radius: 8px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: default; }
      .prose-asta :is(h3) { font-family: var(--display); font-size: 18px; margin: 4px 0 8px; }
      .prose-asta :is(p) { margin: 6px 0; }
      .prose-asta :is(ul, ol) { margin: 6px 0; padding-left: 20px; }
      .prose-asta :is(li) { margin: 3px 0; }
      .prose-asta :is(code) { font-family: var(--mono); background: var(--paper-2); padding: 1px 5px; border-radius: 5px; font-size: 13px; }
      .prose-asta :is(strong) { font-weight: 600; }
    `,
  ],
})
export class KnowledgeHubComponent implements OnInit, OnDestroy {
  private readonly knowledge = inject(KnowledgeService);
  private readonly agent = inject(AgentService);
  private readonly toast = inject(ToastService);

  readonly starters = STARTERS;
  readonly docs = signal<KnowledgeDoc[]>([]);
  readonly selected = signal<Set<string>>(new Set());
  readonly messages = signal<ChatMsg[]>([]);
  readonly steps = signal<WorkflowStepView[]>([]);
  readonly busy = signal(false);
  readonly uploading = signal(false);
  readonly dragOver = signal(false);
  readonly pasteMode = signal(false);
  readonly panel = signal<{ title: string; summary?: DocumentSummary; cards?: Flashcard[] } | null>(null);

  draft = '';
  pasteTitle = '';
  pasteBody = '';
  private sessionId?: string;
  private pollTimer?: ReturnType<typeof setInterval>;

  readonly readyCount = computed(() => this.docs().filter((d) => d.status === 'ready').length);
  readonly canAsk = computed(() => this.readyCount() > 0);
  readonly scopeLabel = computed(() => {
    const n = this.selected().size;
    return n > 0 ? `${n} selected document${n > 1 ? 's' : ''}` : 'all your documents';
  });

  ngOnInit(): void {
    this.refresh();
    this.pollTimer = setInterval(() => {
      if (this.docs().some((d) => d.status !== 'ready' && d.status !== 'failed')) this.refresh();
    }, 1500);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  refresh(): void {
    this.knowledge.list().subscribe({
      next: (docs) => {
        this.docs.set(docs);
        // Drop selections for docs that disappeared.
        const ids = new Set(docs.map((d) => d.id));
        this.selected.update((s) => new Set([...s].filter((id) => ids.has(id))));
      },
      error: () => this.toast.error?.('Could not load documents'),
    });
  }

  // ── upload ──────────────────────────────────────────────────────────────
  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver.set(true);
  }
  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.uploadFile(file);
  }
  onFilePicked(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.uploadFile(file);
    (ev.target as HTMLInputElement).value = '';
  }

  private uploadFile(file: File): void {
    this.uploading.set(true);
    this.knowledge.uploadFile(file).subscribe({
      next: (r) => {
        this.uploading.set(false);
        this.toast.success(r.reused ? 'Already in your library' : 'Uploaded — processing…');
        this.refresh();
      },
      error: (e) => {
        this.uploading.set(false);
        this.toast.error?.(e?.message ?? 'Upload failed');
      },
    });
  }

  submitText(): void {
    this.uploading.set(true);
    this.knowledge.uploadText(this.pasteTitle.trim(), this.pasteBody).subscribe({
      next: () => {
        this.uploading.set(false);
        this.pasteTitle = '';
        this.pasteBody = '';
        this.pasteMode.set(false);
        this.toast.success('Added — processing…');
        this.refresh();
      },
      error: (e) => {
        this.uploading.set(false);
        this.toast.error?.(e?.message ?? 'Could not add text');
      },
    });
  }

  remove(d: KnowledgeDoc): void {
    this.knowledge.remove(d.id).subscribe({
      next: () => {
        this.toast.success('Deleted');
        this.refresh();
      },
    });
  }

  // ── selection / scope ─────────────────────────────────────────────────────
  isSelected(id: string): boolean {
    return this.selected().has(id);
  }
  toggleSelect(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── summary / flashcards ──────────────────────────────────────────────────
  loadSummary(d: KnowledgeDoc): void {
    this.panel.set({ title: `Summary · ${d.title}` });
    this.knowledge.summary(d.id).subscribe({
      next: (summary) => this.panel.set({ title: `Summary · ${d.title}`, summary }),
      error: () => this.toast.error?.('Could not summarize'),
    });
  }
  loadFlashcards(d: KnowledgeDoc): void {
    this.panel.set({ title: `Flashcards · ${d.title}` });
    this.knowledge.flashcards(d.id).subscribe({
      next: (cards) => this.panel.set({ title: `Flashcards · ${d.title}`, cards }),
      error: () => this.toast.error?.('Could not build flashcards'),
    });
  }

  // ── grounded chat ─────────────────────────────────────────────────────────
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
    if (!message || this.busy() || !this.canAsk()) return;
    this.draft = '';
    this.busy.set(true);
    this.steps.set([]);

    this.push({ role: 'user', content: message, sources: [], visualBlocks: [], followUps: [], confidence: 1, streaming: false });
    const assistant: ChatMsg = { role: 'assistant', content: '', sources: [], visualBlocks: [], followUps: [], confidence: 0, streaming: true };
    this.push(assistant);

    const documentIds = [...this.selected()];
    this.agent
      .stream({ message, sessionId: this.sessionId, agentType: 'rag', documentIds: documentIds.length ? documentIds : undefined })
      .subscribe({
        next: (e) => this.onEvent(e, assistant),
        error: () => {
          assistant.streaming = false;
          assistant.content = assistant.content || 'Something went wrong. Please try again.';
          this.bump();
          this.busy.set(false);
        },
      });
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
        assistant.sources = e.response.sources ?? [];
        assistant.visualBlocks = e.response.visualBlocks;
        assistant.followUps = e.response.followUpQuestions;
        assistant.confidence = e.response.confidence;
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

  statusLabel(d: KnowledgeDoc): string {
    if (d.status === 'ready') return 'ready';
    if (d.status === 'failed') return 'failed';
    if (d.status === 'pending') return 'queued';
    return d.status; // parsing / chunking / embedding
  }
  confLabel(c: number): string {
    return c > 0.6 ? 'grounded' : c >= 0.35 ? 'partial' : 'insufficient';
  }
  confColor(c: number): string {
    return c > 0.6 ? 'var(--green-deep)' : c >= 0.35 ? 'var(--peri-deep)' : 'var(--coral-deep)';
  }
  pct(c: number): number {
    return Math.round(c * 100);
  }

  private push(m: ChatMsg): void {
    this.messages.update((list) => [...list, m]);
  }
  private bump(): void {
    this.messages.update((list) => [...list]);
  }
}
