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
import { CardComponent } from '../../shared/ui/card.component';
import { ComposerComponent, ComposerSubmit } from '../../shared/ui/composer.component';
import { AiAgentActivityFeedComponent } from '../../shared/components/ai/ai-agent-activity-feed.component';
import { VisualBlockRendererComponent } from '../../shared/components/ai/visual-block-renderer.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { CountDirective } from '../../shared/directives/count.directive';
import { KnowledgeShardComponent } from './components/knowledge-shard.component';

/** Device-local key for the Hub's grounded Q&A transcript (never persisted server-side). */
const CHAT_KEY = 'asta.knowledge-chat';

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
  imports: [FormsModule, MarkdownPipe, ButtonComponent, CardComponent, ComposerComponent, AiAgentActivityFeedComponent, VisualBlockRendererComponent, MagneticDirective, CountDirective, KnowledgeShardComponent],
  template: `
    <!-- Compact command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Knowledge Hub</h1>
        <span class="goal-pill"><span class="dot"></span>Grounded answers from your docs — {{ scopeLabel() }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="accent" astaMagnetic size="sm" (click)="fileInput.click()" [disabled]="uploading()">Add document</asta-btn>
        <asta-btn variant="ghost" size="sm" (click)="refresh()">Refresh</asta-btn>
      </div>
    </header>

    <!-- Screen-reader-only status for streaming grounded answers (a11y). -->
    <span class="sr-only" aria-live="polite" role="status">{{ liveStatus() }}</span>

    <div class="grid gap-5 lg:grid-cols-[minmax(300px,360px)_1fr]" style="min-height:calc(100dvh - 230px)">
      <!-- LEFT: upload + library -->
      <div class="space-y-5 motion-row-primary">
        <asta-card class="motion-card-reveal" style="--motion-card-index:0" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker">Add to knowledge base</p>
            <span class="panel-ico green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </span>
          </div>
          <div class="drop mt-3" [class.drop-over]="dragOver()"
            (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
            <input #fileInput type="file" class="hidden" accept=".txt,.md,.markdown,.json,.pdf,.docx,text/*"
              (change)="onFilePicked($event)" />
            <span class="drop-glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </span>
            <p class="text-sm text-txt-soft mt-2 mb-2">Drop a file here or</p>
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
        </asta-card>

        <asta-card class="motion-card-reveal" style="--motion-card-index:1" pad="16px 18px">
          <div class="panel-head">
            <p class="kicker">Your documents</p>
            <span class="panel-ico peri" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
          </div>
          @if (docs().length === 0) {
            <div class="text-center py-7">
              <p class="text-sm text-txt-soft mb-3">No documents yet. Add one to start asking grounded questions.</p>
              <asta-btn variant="ghost" size="sm" (click)="fileInput.click()" [disabled]="uploading()">Upload your first doc <span class="arr">→</span></asta-btn>
            </div>
          } @else {
            <div class="lib-controls mt-3">
              <div class="lib-search">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                <input class="lib-search-in" type="search" placeholder="Search title, topic, tag…" [(ngModel)]="searchTerm" (ngModelChange)="search.set($event)" aria-label="Search documents" />
                @if (search()) { <button class="lib-clear" (click)="search.set(''); searchTerm = ''" aria-label="Clear search">✕</button> }
              </div>
              <div class="lib-selects">
                <select class="lib-sel" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" aria-label="Filter by status">
                  <option value="all">All statuses</option>
                  <option value="ready">Ready</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
                <select class="lib-sel" [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)" aria-label="Sort documents">
                  <option value="recent">Newest</option>
                  <option value="title">Title A–Z</option>
                  <option value="size">Most chunks</option>
                </select>
              </div>
            </div>
            <div class="lib-meta">
              <span class="lib-count">{{ filteredDocs().length }} of {{ docs().length }} shown</span>
              @if (readyCount() > 0) {
                <span class="lib-scope">
                  @if (selected().size < readyCount()) {
                    <button class="lib-link" (click)="selectAllReady()">Scope: all ready</button>
                  }
                  @if (selected().size > 0) {
                    <button class="lib-link" (click)="clearSelection()">Clear ({{ selected().size }})</button>
                  }
                </span>
              }
            </div>
          }
          <div class="space-y-2.5 mt-3 motion-row-2">
            @for (d of filteredDocs(); track d.id; let i = $index) {
              <asta-knowledge-shard
                class="block motion-card-reveal"
                [style.--motion-card-index]="i"
                [doc]="d"
                [selected]="isSelected(d.id)"
                (select)="toggleSelect($event.id)"
                (summary)="loadSummary($event)"
                (flashcards)="loadFlashcards($event)"
                (delete)="remove($event)"
                (retry)="retryIngestion($event)"
                (save)="saveDoc($event)"
              />
            }
            @if (docs().length > 0 && filteredDocs().length === 0) {
              <p class="text-sm text-txt-mute text-center py-5">No documents match your search.</p>
            }
          </div>
        </asta-card>
      </div>

      <!-- RIGHT: grounded chat -->
      <div class="flex flex-col card" style="padding:0;overflow:hidden">
        <div class="flex items-center justify-between gap-3 px-5 py-3.5" style="border-bottom:1px solid color-mix(in oklch, var(--paper-3) 60%, transparent)">
          <div class="flex items-center gap-3 min-w-0">
            <span class="rag-orb" [class.busy]="busy()" aria-hidden="true"></span>
            <div class="min-w-0">
              <p class="text-[15px] font-display font-semibold leading-tight">Grounded chat</p>
              <p class="text-[11px] font-mono text-txt-mute">{{ busy() ? 'Retrieving…' : 'Ready' }} · {{ scopeLabel() }}</p>
            </div>
          </div>
        </div>

        @if (panel(); as p) {
          <div class="px-5 py-3" style="border-bottom:1px solid color-mix(in oklch, var(--paper-3) 60%, transparent);background:color-mix(in oklch, var(--paper-2) 50%, transparent)">
            <div class="flex items-center justify-between mb-2">
              <p class="kicker">{{ p.title }}</p>
              <div class="flex items-center gap-3">
                <button class="text-xs text-txt-mute hover:text-txt" (click)="copyPanel(p)">Copy</button>
                <button class="text-xs text-txt-mute hover:text-txt" (click)="panel.set(null)">Close</button>
              </div>
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

        @if (messages().length > 0) {
          <div class="flex items-center justify-between px-5 pt-3">
            <span class="text-[11px] font-mono uppercase tracking-wider text-txt-mute">Conversation · synced to your account</span>
            <button class="text-[11px] text-txt-mute hover:text-txt" (click)="clearChat()">Clear</button>
          </div>
        }
        <div class="flex-1 overflow-y-auto scroll-area px-5 py-5 space-y-5" style="max-height:calc(100dvh - 400px)">
          @if (messages().length === 0) {
            <div class="grid place-items-center text-center py-12">
              <span class="rag-orb big mb-4" aria-hidden="true"></span>
              <p class="t-h-card mb-1">Ask your documents</p>
              <p class="text-txt-soft text-sm mb-5 max-w-[460px]">I cite every claim and say "I don't know" when your docs don't cover it.</p>
              <div class="flex flex-wrap gap-2 justify-center max-w-[520px]">
                @for (s of starters; track s) { <button class="starter-chip" (click)="send(s)" [disabled]="!canAsk()">{{ s }}</button> }
              </div>
              @if (!canAsk()) { <p class="text-xs text-txt-mute mt-4">Add a document first (and wait for it to be "ready").</p> }
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
                  <p class="font-mono text-[11px] text-txt-mute mb-1 flex items-center gap-1.5">
                    <span>rag</span>
                    @if (!msg.streaming) {
                      <span class="conf-pill" [style.color]="confColor(msg.confidence)" [style.background]="confBg(msg.confidence)">
                        <span class="conf-dot" [style.background]="confColor(msg.confidence)"></span>{{ confLabel(msg.confidence) }} · <span [astaCount]="pct(msg.confidence)" suffix="%"></span>
                      </span>
                    }
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
                  @for (block of msg.visualBlocks; track $index) {
                    <div class="mt-3"><ai-visual-block [block_]="block" /></div>
                  }
                </div>
              </div>
            }
          }
          @if (busy()) { <ai-agent-activity-feed [steps]="steps()" [running]="busy()" /> }
        </div>

        <div class="px-4 py-3" style="border-top:1px solid color-mix(in oklch, var(--paper-3) 60%, transparent)">
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
      .lib-controls { display: flex; flex-direction: column; gap: 8px; }
      .lib-search { display: flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-mute); }
      .lib-search:focus-within { border-color: var(--green); color: var(--text-soft); }
      .lib-search-in { flex: 1; min-width: 0; background: transparent; border: none; outline: none; font-size: 13px; color: var(--text); }
      .lib-clear { font-size: 12px; color: var(--text-mute); padding: 0 2px; }
      .lib-clear:hover { color: var(--text); }
      .lib-selects { display: flex; gap: 8px; }
      .lib-sel { flex: 1; font-size: 12px; padding: 6px 8px; border-radius: 9px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: pointer; }
      .lib-sel:focus { outline: none; border-color: var(--green); }
      .lib-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 7px; flex-wrap: wrap; }
      .lib-count { font-size: 11px; color: var(--text-mute); font-variant-numeric: tabular-nums; }
      .lib-scope { display: flex; gap: 10px; }
      .lib-link { font-size: 11px; font-weight: 600; color: var(--green-deep); background: transparent; border: none; cursor: pointer; padding: 0; }
      .lib-link:hover { text-decoration: underline; }
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
  /** Polite screen-reader status for streaming grounded answers (no visual footprint). */
  readonly liveStatus = signal('');
  readonly uploading = signal(false);
  readonly dragOver = signal(false);
  readonly pasteMode = signal(false);
  readonly panel = signal<{ title: string; summary?: DocumentSummary; cards?: Flashcard[] } | null>(null);

  draft = '';
  pasteTitle = '';
  pasteBody = '';
  searchTerm = '';
  private sessionId?: string;
  private pollTimer?: ReturnType<typeof setInterval>;

  // ── library search / filter / sort ──
  readonly search = signal('');
  readonly statusFilter = signal<'all' | 'ready' | 'processing' | 'failed'>('all');
  readonly sortBy = signal<'recent' | 'title' | 'size'>('recent');

  readonly filteredDocs = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sf = this.statusFilter();
    const sort = this.sortBy();
    let list = this.docs();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.topic ?? '').toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (sf !== 'all') {
      list = list.filter((d) =>
        sf === 'processing' ? d.status !== 'ready' && d.status !== 'failed' : d.status === sf,
      );
    }
    const sorted = [...list];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'size') sorted.sort((a, b) => b.chunkCount - a.chunkCount);
    return sorted; // 'recent' keeps the server's createdAt-desc order
  });

  readonly readyCount = computed(() => this.docs().filter((d) => d.status === 'ready').length);
  readonly canAsk = computed(() => this.readyCount() > 0);
  readonly scopeLabel = computed(() => {
    const n = this.selected().size;
    return n > 0 ? `${n} selected document${n > 1 ? 's' : ''}` : 'all your documents';
  });

  ngOnInit(): void {
    this.restoreChat();
    this.refresh();
    this.pollTimer = setInterval(() => {
      if (this.docs().some((d) => d.status !== 'ready' && d.status !== 'failed')) this.refresh();
    }, 1500);
  }

  /**
   * Q&A history syncs across devices via the server; the local cache is an offline fallback.
   * Try the server first; fall back to the device cache if it's unreachable.
   */
  private restoreChat(): void {
    this.knowledge.listQa().subscribe({
      next: (turns) => {
        if (turns.length) {
          const msgs: ChatMsg[] = [];
          for (const t of turns) {
            msgs.push({ role: 'user', content: t.question, sources: [], visualBlocks: [], followUps: [], confidence: 1, streaming: false });
            msgs.push({ role: 'assistant', content: t.answer, sources: (t.sources as ChatMsg['sources']) ?? [], visualBlocks: [], followUps: [], confidence: t.confidence, streaming: false });
          }
          this.messages.set(msgs);
        } else {
          this.restoreLocal();
        }
      },
      error: () => this.restoreLocal(),
    });
  }

  private restoreLocal(): void {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { messages: ChatMsg[]; sessionId?: string };
      if (Array.isArray(saved.messages) && saved.messages.length) {
        this.messages.set(saved.messages.map((m) => ({ ...m, streaming: false })));
        if (saved.sessionId) this.sessionId = saved.sessionId;
      }
    } catch {
      /* corrupt cache — ignore */
    }
  }

  /** Local offline cache (server is the source of truth — see saveTurnToServer). */
  private persistChat(): void {
    try {
      const settled = this.messages().filter((m) => !m.streaming);
      if (!settled.length) { localStorage.removeItem(CHAT_KEY); return; }
      localStorage.setItem(CHAT_KEY, JSON.stringify({ messages: settled, sessionId: this.sessionId }));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }

  /** Persist a completed turn to the server history (best-effort — local cache already holds it). */
  private saveTurnToServer(assistant: ChatMsg): void {
    const msgs = this.messages();
    const ai = msgs.lastIndexOf(assistant);
    const question = ai > 0 && msgs[ai - 1].role === 'user' ? msgs[ai - 1].content : '';
    if (!question || !assistant.content) return;
    this.knowledge.saveQa({
      question,
      answer: assistant.content,
      sources: assistant.sources,
      confidence: assistant.confidence,
    }).subscribe({ next: () => undefined, error: () => undefined });
  }

  clearChat(): void {
    this.messages.set([]);
    this.steps.set([]);
    this.sessionId = undefined;
    try { localStorage.removeItem(CHAT_KEY); } catch { /* ignore */ }
    this.knowledge.clearQa().subscribe({ next: () => undefined, error: () => undefined });
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

  /** Save edited title/tags from a shard, replacing it in place. */
  saveDoc(e: { doc: KnowledgeDoc; title: string; tags: string[] }): void {
    this.knowledge.update(e.doc.id, { title: e.title, tags: e.tags }).subscribe({
      next: (upd) => {
        this.docs.update((list) => list.map((d) => (d.id === upd.id ? upd : d)));
        this.toast.success('Document updated');
      },
      error: () => this.toast.error?.('Could not update document'),
    });
  }

  /** Failed ingestion: no server-side reprocess endpoint exists, so clear the
   *  failed shard and prompt a fresh upload (the honest "retry" path). */
  retryIngestion(d: KnowledgeDoc): void {
    this.knowledge.remove(d.id).subscribe({
      next: () => {
        this.toast.success('Removed the failed document — upload it again to retry ingestion.');
        this.selected.update((s) => {
          const next = new Set(s);
          next.delete(d.id);
          return next;
        });
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  /** Scope the grounded chat to every ready document at once. */
  selectAllReady(): void {
    const ids = this.docs().filter((d) => d.status === 'ready').map((d) => d.id);
    this.selected.set(new Set(ids));
  }
  clearSelection(): void {
    this.selected.set(new Set());
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
  copyPanel(p: { title: string; summary?: DocumentSummary; cards?: Flashcard[] }): void {
    const lines: string[] = [`# ${p.title}`, ''];
    if (p.summary) {
      lines.push(p.summary.tldr, '', '## Key points', ...p.summary.keyPoints.map((k) => `- ${k}`));
    }
    if (p.cards?.length) {
      lines.push('## Flashcards', '');
      for (const c of p.cards) lines.push(`**Q: ${c.question}**`, `A: ${c.answer}`, '');
    }
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success?.('Copied as Markdown'),
      () => this.toast.error?.('Copy failed'),
    );
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
    this.liveStatus.set('Asta is retrieving an answer…');
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
          this.liveStatus.set('The answer failed to load.');
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
        this.persistChat();
        this.saveTurnToServer(assistant);
        this.busy.set(false);
        this.liveStatus.set('Answer ready.');
        break;
      case 'error':
        assistant.streaming = false;
        assistant.content = assistant.content || e.message;
        this.bump();
        this.busy.set(false);
        this.liveStatus.set('The answer failed to load.');
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
  confBg(c: number): string {
    return c > 0.6
      ? 'color-mix(in oklch, var(--green) 14%, transparent)'
      : c >= 0.35
        ? 'color-mix(in oklch, var(--peri) 14%, transparent)'
        : 'color-mix(in oklch, var(--coral) 14%, transparent)';
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
