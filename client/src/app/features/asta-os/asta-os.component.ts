import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgentService } from '../../core/services/agent.service';
import { ToastService } from '../../core/services/toast.service';
import { DomainBusService } from '../../core/services/domain-bus.service';
import { AuthService } from '../../core/services/auth.service';
import { IntelligenceService } from '../../core/services/intelligence.service';
import { VoiceActivationService } from '../../core/services/voice-activation.service';
import { MemoryService } from '../../core/services/memory.service';
import { KnowledgeService } from '../../core/services/knowledge.service';
import { CodeHandoffService } from '../../core/services/code-handoff.service';
import { ExplainKind, TransformKind } from './asta-os-learning-canvas.component';
import { RunCodeRequest } from '../../shared/components/ai/rich-content.component';
import { TextToSpeechService } from '../../core/services/text-to-speech.service';
import { GuardianService } from '../../core/services/guardian.service';
import { AstaModeService } from '../../core/services/asta-mode.service';
import { AgentAction, AgentResponse, AgentStreamEvent, AstaMemorySuggestion, NextAction } from '../../core/models';
import { AstaOsOrbComponent } from './asta-os-orb.component';
import { AstaOsModeToggleComponent } from './asta-os-mode-toggle.component';
import { AstaOsSessionModeToggleComponent } from './asta-os-session-mode-toggle.component';
import { AstaOsLearningModeComponent } from './asta-os-learning-mode.component';
import { AstaOsComposerComponent } from './asta-os-composer.component';
import { AstaOsAgentActivityComponent } from './asta-os-agent-activity.component';
import { AstaOsContextPanelComponent } from './asta-os-context-panel.component';
import { AstaOsTodayStripComponent } from './asta-os-today-strip.component';
import { AstaOsSideDockComponent } from './asta-os-side-dock.component';
import { AstaOsVoiceRoomComponent } from './asta-os-voice-room.component';
import { AstaOsFaceRoomComponent } from './asta-os-face-room.component';
import { AstaOsLearningCanvasComponent } from './asta-os-learning-canvas.component';
import { AstaOsMemoryCardComponent } from './asta-os-memory-card.component';
import { AstaOsToolModuleComponent } from './asta-os-tool-module.component';
import { AstaOsOnboardingComponent } from './asta-os-onboarding.component';
import { AstaOsIntroComponent } from './asta-os-intro.component';
import { AstaOsHistoryComponent } from './asta-os-history.component';
import { AstaTool, toolById, toolForRoute } from './asta-os-tools';
import { detectMemory } from './memory-detect';
import { COMPOSER_PLACEHOLDER, GREETING_PROMPT, GREETING_SUBTEXT, friendlyActivity, tutorModeFor } from './asta-os.constants';
import { AstaActivityRow, AstaLearningMode, AstaOrbState, AstaSessionMode, AstaTurn } from './asta-os.types';

/** A parallel session tab: its own thread + server session id. */
interface CockpitTab {
  id: string;
  title: string;
  turns: AstaTurn[];
  sessionId?: string;
}

/**
 * Asta OS — the Living Learning Cockpit. One central workspace where the learner
 * talks to Asta (chat / voice / face) and screens become contextual tools. Wires
 * the universal composer to the EXISTING Agent OS streaming pipeline
 * (AgentService.stream → Socket.IO), drives the orb's state from the live run,
 * and surfaces the learner's real context (intelligence snapshot + next action).
 */
@Component({
    selector: 'asta-os',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'asta-os-root' },
    imports: [
        FormsModule,
        AstaOsOrbComponent,
        AstaOsModeToggleComponent,
        AstaOsSessionModeToggleComponent,
        AstaOsLearningModeComponent,
        AstaOsComposerComponent,
        AstaOsAgentActivityComponent,
        AstaOsContextPanelComponent,
        AstaOsTodayStripComponent,
        AstaOsSideDockComponent,
        AstaOsVoiceRoomComponent,
        AstaOsFaceRoomComponent,
        AstaOsLearningCanvasComponent,
        AstaOsMemoryCardComponent,
        AstaOsToolModuleComponent,
        AstaOsOnboardingComponent,
        AstaOsIntroComponent,
        AstaOsHistoryComponent,
    ],
    template: `
    <div class="os" [class.focus]="focusMode()">
      <!-- ambient aurora + constellation -->
      <div class="ambient" aria-hidden="true"><span class="a1"></span><span class="a2"></span><span class="grid"></span></div>

      <!-- collapsed left rail (desktop) -->
      <div class="dock-col"><asta-os-side-dock (openTool)="onDockTool($event)" /></div>

      <div class="stage">
        <!-- top row -->
        <header class="top">
          <div class="hello">
            <p class="greet">{{ greeting() }}</p>
            <p class="kick">Asta OS · Your AI learning operating system</p>
          </div>
          <div class="controls">
            <asta-os-history (newSession)="newTab()" (select)="loadSession($event)" />
            @if (turns().length) {
              @if (searchOpen()) {
                <div class="search">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  <input #searchBox class="search-in" [(ngModel)]="searchText" (ngModelChange)="searchQuery.set($event)" placeholder="Search this chat…" aria-label="Search conversation" />
                  @if (searchQuery().trim()) { <span class="search-n">{{ matchCount() }}</span> }
                  <button type="button" class="search-x" (click)="toggleSearch(false)" aria-label="Close search">×</button>
                </div>
              } @else {
                <button type="button" class="ctl-btn" (click)="toggleSearch(true)" title="Search conversation" aria-label="Search conversation">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                </button>
              }
              <button type="button" class="ctl-btn" (click)="exportConversation()" title="Export conversation" aria-label="Export conversation">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              </button>
            }
            <button type="button" class="ctl-btn" [class.ctl-on]="focusMode()" (click)="focusMode.set(!focusMode())"
              [title]="focusMode() ? 'Exit large view (Esc)' : 'Large view — hide side panels'"
              [attr.aria-label]="focusMode() ? 'Exit large view' : 'Large view'">
              @if (focusMode()) {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              } @else {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              }
            </button>
            <asta-os-learning-mode [active]="learningMode()" (change)="learningMode.set($event)" />
            <asta-os-session-mode-toggle [active]="sessionMode()" (change)="sessionMode.set($event)" />
            @if (voice.wakeEnabled()) { <span class="wake"><span class="ping"></span> Wake word on</span> }
            <asta-os-mode-toggle />
          </div>
        </header>

        <!-- session tabs -->
        @if (tabs().length > 1) {
          <div class="tabs" role="tablist">
            @for (t of tabViews(); track t.id) {
              <div class="tab" [class.on]="t.id === activeTabId()" role="tab" [attr.aria-selected]="t.id === activeTabId()">
                <button type="button" class="tab-pick" (click)="switchTab(t.id)" [disabled]="busy()">{{ t.title }}</button>
                <button type="button" class="tab-x" (click)="closeTab(t.id)" aria-label="Close tab">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            }
            <button type="button" class="tab-new" (click)="newTab()" [disabled]="busy()" aria-label="New session tab">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        }

        <!-- center -->
        <main class="center">
          @if (turns().length === 0) {
            <section class="welcome">
              <asta-os-orb [state]="orbState()" size="hero" />
              <h1 class="q">{{ greetingPrompt }}</h1>
              <p class="sub">{{ greetingSubtext }}</p>
            </section>
          } @else {
            <section class="canvas-wrap" #canvasWrap (scroll)="onCanvasScroll()">
              <asta-os-learning-canvas
                [turns]="turns()"
                [readingId]="readingId()"
                [query]="searchQuery()"
                (editTurn)="onEdit($event)"
                (ask)="send($event)"
                (action)="runAction($event)"
                (retry)="retry()"
                (feedback)="onFeedback($event)"
                (openTool)="onOpenTool($event)"
                (verify)="onVerify($event)"
                (copy)="onCopyTurn($event)"
                (regenerate)="onRegenerate($event)"
                (saveNote)="onSaveNote($event)"
                (explain)="onExplain($event)"
                (transform)="onTransform($event)"
                (readAloud)="onReadAloud($event)"
                (runCode)="onRunCode($event)"
              />
            </section>
            @if (!atBottom()) {
              <button type="button" class="jump" (click)="scrollToBottom()" aria-label="Jump to latest">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                Latest
              </button>
            }
          }

          <asta-os-agent-activity [rows]="activity()" />

          @if (pendingMemory(); as mem) {
            <asta-os-memory-card
              [suggestion]="mem"
              [saving]="savingMemory()"
              (save)="onSaveMemory($event)"
              (dismiss)="onDismissMemory()"
            />
          }

          <div class="composer-wrap">
            <asta-os-composer
              [placeholder]="placeholder()"
              [disabled]="busy()"
              [micSupported]="voice.supported"
              [listening]="voice.state() === 'listening'"
              [seed]="composerSeed()"
              [focusNonce]="focusNonce()"
              (send)="send($event)"
              (attach)="pendingFiles.set($event)"
              (mic)="onMic()"
            />
          </div>

          <asta-os-today-strip [next]="next()" (act)="send($event)" />
        </main>
      </div>

      <!-- right context -->
      <div class="context-col"><asta-os-context-panel [intel]="intel()" [next]="next()" /></div>

      <!-- mobile bottom nav (desktop uses the side dock) -->
      <nav class="mnav" aria-label="Asta OS">
        @for (n of mobileNav; track n.label) {
          <button type="button" class="mnav-b" (click)="mobileGo(n)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="n.icon" /></svg>
            <span>{{ n.label }}</span>
          </button>
        }
      </nav>
    </div>

    @if (activeTool(); as tool) {
      <asta-os-tool-module [tool]="tool" (close)="activeTool.set(null)" (ask)="onToolAsk($event)" />
    }

    @if (sessionMode() === 'voice') {
      <asta-os-voice-room (close)="sessionMode.set('chat')" />
    } @else if (sessionMode() === 'face') {
      <asta-os-face-room (close)="sessionMode.set('chat')" />
    }

    @if (showOnboarding()) {
      <asta-os-onboarding [greeting]="greeting()" (choose)="onOnboard($event)" (skip)="dismissOnboard()" />
    }

    @if (playIntro()) {
      <asta-os-intro (done)="playIntro.set(false)" />
    }
  `,
    styles: [
        `
      :host { display: block; min-height: 100%; color: var(--asta-text); background: var(--asta-bg); }
      .os {
        position: relative;
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr) clamp(280px, 24vw, 360px);
        gap: 16px;
        min-height: 100dvh;
        padding: 16px;
      }
      .ambient { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
      .ambient .a1, .ambient .a2 { position: absolute; border-radius: 999px; filter: blur(80px); opacity: .35; }
      .ambient .a1 { width: 460px; height: 460px; top: -120px; left: 18%; background: radial-gradient(circle, var(--asta-green-deep), transparent 70%); }
      .ambient .a2 { width: 520px; height: 520px; bottom: -160px; right: 8%; background: radial-gradient(circle, var(--asta-violet), transparent 70%); }
      .ambient .grid { position: absolute; inset: 0; background-image: radial-gradient(color-mix(in srgb, var(--asta-cyan) 14%, transparent) 1px, transparent 1px); background-size: 34px 34px; opacity: .25; mask-image: radial-gradient(ellipse at 50% 0%, #000, transparent 75%); }

      .dock-col, .context-col, .stage { position: relative; z-index: 1; }
      .dock-col { border-radius: 18px; background: var(--asta-panel); border: 1px solid var(--asta-border); backdrop-filter: blur(16px); }

      .stage { display: flex; flex-direction: column; min-width: 0; }
      .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
      .greet { font-family: var(--display); font-size: 24px; font-weight: 600; line-height: 1.1; }
      .kick { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-muted); margin-top: 4px; }
      .controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .wake { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--asta-green); font-family: var(--mono); }
      .ctl-btn { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--asta-muted); border: 1px solid var(--asta-border); background: var(--asta-panel); transition: color .15s ease, border-color .15s ease; }
      .ctl-btn:hover { color: var(--asta-text); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); }
      .search { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 8px 0 11px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--asta-green) 40%, transparent); background: var(--asta-panel); color: var(--asta-muted); }
      .search-in { width: 150px; border: 0; outline: 0; background: transparent; color: var(--asta-text); font-size: 13px; }
      .search-n { font-family: var(--mono); font-size: 11px; color: var(--asta-subtle); white-space: nowrap; }
      .search-x { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; color: var(--asta-subtle); font-size: 16px; line-height: 1; }
      .search-x:hover { color: var(--asta-text); }
      .wake .ping { width: 7px; height: 7px; border-radius: 999px; background: var(--asta-green); box-shadow: 0 0 8px var(--asta-green); }

      .tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
      .tab { display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 12px; border-radius: 999px; border: 1px solid var(--asta-border); background: var(--asta-panel); max-width: 200px; transition: border-color .16s ease, background .16s ease; }
      .tab.on { border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); background: var(--asta-panel-strong); }
      .tab-pick { font-size: 12.5px; color: var(--asta-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
      .tab.on .tab-pick { color: var(--asta-text); font-weight: 600; }
      .tab-x { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; color: var(--asta-subtle); }
      .tab-x:hover { color: var(--asta-coral); background: var(--asta-panel); }
      .tab-new { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 999px; color: var(--asta-muted); border: 1px solid var(--asta-border); }
      .tab-new:hover { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); }

      .center { display: flex; flex-direction: column; gap: 16px; flex: 1; min-height: 0; position: relative; }
      .jump { position: absolute; left: 50%; transform: translateX(-50%); bottom: 8px; z-index: 5; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); box-shadow: 0 8px 24px rgba(0,0,0,.35); animation: cgUp .25s ease both; }
      .center.face { justify-content: center; }
      .welcome { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; padding: 6vh 16px 2vh; animation: cgUp .5s cubic-bezier(.2,.7,.2,1) both; }
      .welcome .q { font-family: var(--display); font-size: clamp(26px, 4vw, 40px); font-weight: 600; animation: cgUp .55s cubic-bezier(.2,.7,.2,1) .08s both; }
      .welcome .sub { animation: cgUp .55s cubic-bezier(.2,.7,.2,1) .16s both; }
      .composer-wrap { animation: cgUp .5s cubic-bezier(.2,.7,.2,1) .12s both; }
      @keyframes cgUp { from { opacity: 0; transform: translateY(14px); } }
      @media (prefers-reduced-motion: reduce) { .welcome, .welcome .q, .welcome .sub, .composer-wrap { animation: none; } }
      .welcome .sub { max-width: 540px; color: var(--asta-muted); font-size: 15px; line-height: 1.55; }
      .canvas-wrap { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 4px 8px; }

      /* Large view: side panels fold away, the conversation takes the full width
         (readable measure preserved). Esc exits. */
      .os.focus { grid-template-columns: minmax(0, 1fr); }
      .os.focus .dock-col, .os.focus .context-col { display: none; }
      .os.focus .center { max-width: 1080px; width: 100%; margin: 0 auto; }
      .ctl-btn.ctl-on { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); }

      .composer-wrap { margin-top: auto; }

      .mnav { display: none; }

      @media (max-width: 1024px) {
        .os { grid-template-columns: 1fr; padding: 12px 12px 84px; gap: 12px; }
        .dock-col, .context-col { display: none; }
        .mnav {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 70;
          display: flex; justify-content: space-around; gap: 4px;
          padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0));
          background: color-mix(in srgb, var(--asta-bg-soft) 88%, transparent);
          border-top: 1px solid var(--asta-border); backdrop-filter: blur(18px);
        }
        .mnav-b { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10.5px; color: var(--asta-muted); padding: 4px 8px; border-radius: 12px; }
        .mnav-b:active { color: var(--asta-green); }
      }
    `,
    ]
})
export class AstaOsComponent {
  protected readonly agent = inject(AgentService);
  protected readonly voice = inject(VoiceActivationService);
  private readonly toast = inject(ToastService);
  private readonly bus = inject(DomainBusService);
  private readonly memory = inject(MemoryService);
  private readonly guardian = inject(GuardianService);
  private readonly mode = inject(AstaModeService);
  private readonly intelligence = inject(IntelligenceService);

  protected readonly mobileNav: { label: string; kind: 'route' | 'tool' | 'classic'; target: string; icon: string }[] = [
    { label: 'Asta', kind: 'route', target: '/app/os', icon: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3' },
    { label: 'Practice', kind: 'route', target: '/app/os/practice', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
    { label: 'Notebook', kind: 'route', target: '/app/os/notebook', icon: 'M4 4h16v12H4zM2 20h20M9 9l2 2 4-4' },
    { label: 'Tools', kind: 'tool', target: 'roadmap', icon: 'M4 19c0-8 7-14 16-14M4 19h.01M20 5h.01' },
    { label: 'Classic', kind: 'classic', target: '', icon: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
  ];
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly knowledge = inject(KnowledgeService);
  private readonly codeHandoff = inject(CodeHandoffService);
  private readonly tts = inject(TextToSpeechService);
  protected readonly readingId = signal<string | null>(null);
  private readonly canvasWrap = viewChild<ElementRef<HTMLElement>>('canvasWrap');
  protected readonly atBottom = signal(true);
  /** Files attached in the composer, uploaded + grounded into the next send. */
  protected readonly pendingFiles = signal<File[]>([]);
  protected readonly searchOpen = signal(false);
  /** Large view: dock + context panel fold away; the conversation gets the screen. */
  protected readonly focusMode = signal(false);
  protected readonly searchQuery = signal('');
  protected searchText = '';
  /** Seed pushed into the composer for edit-and-resend (nonce forces re-fill). */
  protected readonly composerSeed = signal<{ text: string; nonce: number } | null>(null);
  protected readonly focusNonce = signal(0);
  private seedSeq = 0;
  protected readonly matchCount = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return '';
    const n = this.turns().filter((t) => t.content.toLowerCase().includes(q)).length;
    return n === 1 ? '1 match' : `${n} matches`;
  });

  protected readonly greetingPrompt = GREETING_PROMPT;
  protected readonly greetingSubtext = GREETING_SUBTEXT;

  protected readonly sessionMode = signal<AstaSessionMode>('chat');
  protected readonly learningMode = signal<AstaLearningMode>('balanced');
  protected readonly turns = signal<AstaTurn[]>([]);
  protected readonly activity = signal<AstaActivityRow[]>([]);
  protected readonly busy = signal(false);
  private readonly errored = signal(false);

  protected readonly intel = this.intelligence.snapshot;
  protected readonly next = signal<NextAction | null>(null);
  protected readonly pendingMemory = signal<AstaMemorySuggestion | null>(null);
  protected readonly savingMemory = signal(false);
  /** The tool currently open as a dialog (one at a time). */
  protected readonly activeTool = signal<AstaTool | null>(null);
  protected readonly showOnboarding = signal(this.firstVisit());
  protected readonly playIntro = signal(this.mode.consumeIntro());

  // Parallel session tabs. The live `turns`/`sessionId` belong to the active tab;
  // switching persists them back into the tab record and loads the target's.
  protected readonly tabs = signal<CockpitTab[]>([{ id: 't0', title: 'New session', turns: [] }]);
  protected readonly activeTabId = signal('t0');
  protected readonly tabViews = computed(() =>
    this.tabs().map((t) => ({ id: t.id, title: t.id === this.activeTabId() ? this.tabTitle(this.turns()) : t.title })),
  );
  private tabSeq = 1;

  private sessionId?: string;
  private lastPrompt = '';
  private activitySeq = 0;

  protected readonly placeholder = computed(() => COMPOSER_PLACEHOLDER[this.sessionMode()]);

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const name = this.auth.user()?.name?.trim().split(/\s+/)[0] ?? 'there';
    return `Good ${part}, ${name}.`;
  });

  /** The orb's emotional state, derived from voice + the live run. */
  protected readonly orbState = computed<AstaOrbState>(() => {
    if (this.voice.state() === 'listening') return 'listening';
    if (this.errored()) return 'error';
    if (this.busy()) return this.lastTurnHasContent() ? 'speaking' : 'agents-running';
    if (this.voice.speaking()) return 'speaking';
    return 'idle';
  });

  constructor() {
    this.intelligence.load();
    this.agent
      .nextAction()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (n) => this.next.set(n), error: () => this.next.set(null) });
    // Follow the conversation as it streams — but only while the user is at the bottom.
    effect(() => {
      this.turns();
      if (this.atBottom()) requestAnimationFrame(() => this.scrollToBottom(false));
    });
  }

  /** Cmd/Ctrl-K focuses the composer; Esc closes search, then large view. */
  @HostListener('document:keydown', ['$event'])
  protected onGlobalKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.focusNonce.update((n) => n + 1);
    } else if (e.key === 'Escape' && this.searchOpen()) {
      this.toggleSearch(false);
    } else if (e.key === 'Escape' && this.focusMode()) {
      this.focusMode.set(false);
    }
  }

  protected onCanvasScroll(): void {
    const el = this.canvasWrap()?.nativeElement;
    if (!el) return;
    this.atBottom.set(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  protected scrollToBottom(mark = true): void {
    const el = this.canvasWrap()?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (mark) this.atBottom.set(true);
  }

  protected send(text: string): void {
    const message = text.trim();
    if (!message || this.busy()) return;
    this.lastPrompt = message;
    this.errored.set(false);
    this.busy.set(true);
    this.activity.set([]);
    this.atBottom.set(true); // follow the new turn as it streams

    const mode = tutorModeFor(this.learningMode());
    const suggestion = detectMemory(message);
    if (suggestion) this.pendingMemory.set(suggestion);

    const files = this.pendingFiles();
    this.pendingFiles.set([]);
    const userContent = files.length
      ? `${message}\n\n📎 ${files.map((f) => f.name).join(', ')}`
      : message;
    this.turns.update((list) => [...list, this.userTurn(userContent)]);
    const asta = this.astaTurn();
    asta.learningMode = this.learningMode();
    this.turns.update((list) => [...list, asta]);

    if (files.length) {
      // Upload attachments → ground the answer on them via documentIds.
      forkJoin(files.map((f) => this.knowledge.uploadFile(f)))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (results) => this.streamTurn(message, mode, asta, results.map((r) => r.documentId)),
          error: () => {
            this.toast.error('Could not read an attachment — answering without it');
            this.streamTurn(message, mode, asta);
          },
        });
    } else {
      this.streamTurn(message, mode, asta);
    }
  }

  private streamTurn(message: string, mode: string, asta: AstaTurn, documentIds?: string[]): void {
    this.agent
      .stream({ message, sessionId: this.sessionId, mode, documentIds })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (e) => {
          // A terminal stream error event (transport/auth/busy/orchestrator) completes
          // the socket observable rather than erroring it — route it to the REST
          // fallback so a recoverable failure still gets answered, not failed.
          if (e.type === 'error') {
            this.onStreamError(message, asta);
            return;
          }
          this.onEvent(e, asta);
        },
        error: () => this.onStreamError(message, asta),
      });
  }

  /** WebSocket stream died: keep partial content if any, else fall back to REST. */
  private onStreamError(message: string, asta: AstaTurn): void {
    if (asta.content) {
      asta.streaming = false;
      this.completeActivity();
      this.bump();
      this.busy.set(false);
      return;
    }
    this.agent
      .send(message, { sessionId: this.sessionId, mode: tutorModeFor(this.learningMode()) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.sessionId = r.sessionId;
          this.applyResponse(asta, r.response, r.messageId);
          this.completeActivity();
          this.bump();
          this.busy.set(false);
        },
        error: () => this.fail(asta),
      });
  }

  protected retry(): void {
    if (this.lastPrompt) this.send(this.lastPrompt);
  }

  // ───────────────────────── session tabs ─────────────────────────

  /** Open a fresh tab (parallel session). Persists the current tab first. */
  protected newTab(): void {
    if (this.busy()) return;
    this.persistActiveTab();
    const id = `t${this.tabSeq++}`;
    this.tabs.update((ts) => [...ts, { id, title: 'New session', turns: [] }]);
    this.activeTabId.set(id);
    this.clearLive();
  }

  protected switchTab(id: string): void {
    if (this.busy() || id === this.activeTabId()) return;
    this.persistActiveTab();
    const tab = this.tabs().find((t) => t.id === id);
    if (!tab) return;
    this.activeTabId.set(id);
    this.turns.set(tab.turns);
    this.sessionId = tab.sessionId;
    this.activity.set([]);
    this.errored.set(false);
    this.lastPrompt = '';
  }

  protected closeTab(id: string): void {
    // Don't let a tab close mid-stream — the live turn is bound to this tab and
    // would be orphaned/lost if the tab list changed under it (P0 tab/history race).
    if (this.busy() && id === this.activeTabId()) {
      this.toast.error('Asta is still answering — let it finish before closing this tab.');
      return;
    }
    const ts = this.tabs();
    if (ts.length <= 1) {
      this.clearLive();
      this.tabs.set([{ id: this.activeTabId(), title: 'New session', turns: [] }]);
      return;
    }
    const idx = ts.findIndex((t) => t.id === id);
    const remaining = ts.filter((t) => t.id !== id);
    this.tabs.set(remaining);
    if (this.activeTabId() === id) {
      const target = remaining[Math.max(0, idx - 1)];
      this.activeTabId.set(target.id);
      this.turns.set(target.turns);
      this.sessionId = target.sessionId;
      this.activity.set([]);
      this.errored.set(false);
    }
  }

  private persistActiveTab(): void {
    const id = this.activeTabId();
    const turns = this.turns();
    this.tabs.update((ts) =>
      ts.map((t) => (t.id === id ? { ...t, turns, sessionId: this.sessionId, title: this.tabTitle(turns) } : t)),
    );
  }

  private clearLive(): void {
    this.turns.set([]);
    this.activity.set([]);
    this.sessionId = undefined;
    this.lastPrompt = '';
    this.errored.set(false);
  }

  private tabTitle(turns: readonly AstaTurn[]): string {
    const first = turns.find((t) => t.role === 'user');
    if (!first) return 'New session';
    return first.content.length > 26 ? `${first.content.slice(0, 26)}…` : first.content;
  }

  /**
   * Reopen a past server session. Persists the current tab first and opens the
   * history session in its OWN tab (or switches to it if already open), so a live
   * tab is never clobbered mid-stream (P0 tab/history race).
   */
  protected loadSession(id: string): void {
    if (this.busy()) {
      this.toast.error('Asta is still answering — try again in a moment.');
      return;
    }
    const existing = this.tabs().find((t) => t.sessionId === id);
    if (existing) {
      this.switchTab(existing.id);
      return;
    }
    this.persistActiveTab();
    this.agent
      .getMessages(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (msgs) => {
          const turns: AstaTurn[] = msgs.map((m) => ({
            role: m.role === 'assistant' ? 'asta' : 'user',
            content: m.content,
            blocks: m.visualBlocks ?? [],
            actions: m.actions ?? [],
            followUps: m.followUpQuestions ?? [],
            recommended: m.recommendedNextActions ?? [],
            sources: m.sources ?? [],
            agentType: m.agentType,
            confidence: m.confidence,
            streaming: false,
            failed: false,
            messageId: m.id,
          }));
          const tabId = `t${this.tabSeq++}`;
          this.tabs.update((ts) => [
            ...ts,
            { id: tabId, title: this.tabTitle(turns), turns, sessionId: id },
          ]);
          this.activeTabId.set(tabId);
          this.turns.set(turns);
          this.sessionId = id;
          this.activity.set([]);
          this.errored.set(false);
          this.lastPrompt = '';
        },
        error: () => this.toast.error('Couldn’t load that session'),
      });
  }

  protected onSaveMemory(suggestion: AstaMemorySuggestion): void {
    this.savingMemory.set(true);
    this.memory
      .confirm(suggestion, 'save')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Asta will remember that');
          this.pendingMemory.set(null);
          this.savingMemory.set(false);
        },
        error: () => this.savingMemory.set(false),
      });
  }

  protected onDismissMemory(): void {
    const suggestion = this.pendingMemory();
    this.pendingMemory.set(null);
    if (!suggestion) return;
    // Record the dismissal for the audit trail; outcome doesn't affect the UI.
    this.memory.confirm(suggestion, 'dismiss').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }

  protected onFeedback(e: { turn: AstaTurn; rating: 'up' | 'down' }): void {
    if (e.turn.feedback) return;
    e.turn.feedback = e.rating;
    this.bump();
    this.agent.sendFeedback(e.rating, e.turn.messageId).subscribe({
      next: () => this.toast.success('Thanks — Asta will use this'),
      error: () => {
        e.turn.feedback = undefined;
        this.bump();
      },
    });
  }

  // ───────────────────────── message actions ─────────────────────────

  protected onCopyTurn(turn: AstaTurn): void {
    void navigator.clipboard?.writeText(turn.content).then(() => this.toast.success('Answer copied'));
  }

  /** Re-ask the user prompt that produced this answer. */
  protected onRegenerate(turn: AstaTurn): void {
    const list = this.turns();
    const idx = list.indexOf(turn);
    // Walk back to the nearest preceding user turn.
    for (let i = idx - 1; i >= 0; i--) {
      if (list[i].role === 'user') {
        this.send(list[i].content);
        return;
      }
    }
    if (this.lastPrompt) this.send(this.lastPrompt);
  }

  /** Save an answer into the learner's knowledge base as a note they can re-query. */
  protected onSaveNote(turn: AstaTurn): void {
    const firstLine = turn.content.replace(/[#*`>]/g, '').trim().split('\n')[0].slice(0, 60);
    const title = `Asta note — ${firstLine || 'saved answer'}`;
    this.knowledge.uploadText(title, turn.content).subscribe({
      next: () => this.toast.success('Saved to your notes'),
      error: () => this.toast.error('Could not save the note'),
    });
  }

  /** "Explain differently" — send a contextual re-explanation instruction. */
  protected onExplain(e: { turn: AstaTurn; kind: ExplainKind }): void {
    const prompts: Record<ExplainKind, string> = {
      simpler: 'Explain your last answer again, but much simpler — like I am new to this.',
      analogy: 'Re-explain that using a concrete real-world analogy.',
      examples: 'Give me a few concrete worked examples of that.',
      visualize: 'Show that as a diagram I can picture.',
    };
    this.send(prompts[e.kind]);
  }

  /** "Turn this into…" — bridge the answer to a learning artifact via a templated ask. */
  protected onTransform(e: { turn: AstaTurn; kind: TransformKind }): void {
    const prompts: Record<TransformKind, string> = {
      quiz: 'Turn your last answer into a short quiz I can take now.',
      flashcards: 'Turn your last answer into a set of flashcards.',
      diagram: 'Turn your last answer into a diagram I can picture.',
    };
    this.send(prompts[e.kind]);
  }

  /** Read an answer aloud (toggles). Strips markdown so the TTS sounds natural. */
  protected onReadAloud(turn: AstaTurn): void {
    if (this.tts.speaking() && this.readingId() === turn.messageId) {
      this.tts.cancel();
      this.readingId.set(null);
      return;
    }
    this.tts.cancel();
    const plain = turn.content
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/[#*_`>~|]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return;
    this.readingId.set(turn.messageId ?? null);
    void this.tts.speak(plain).finally(() => {
      if (this.readingId() === turn.messageId) this.readingId.set(null);
    });
  }

  protected toggleSearch(open: boolean): void {
    this.searchOpen.set(open);
    if (!open) {
      this.searchText = '';
      this.searchQuery.set('');
    }
  }

  /** Edit & resend: load a previous user message back into the composer. */
  protected onEdit(turn: AstaTurn): void {
    this.composerSeed.set({ text: turn.content, nonce: ++this.seedSeq });
  }

  /** Download the current session as a Markdown transcript. */
  protected exportConversation(): void {
    const turns = this.turns();
    if (!turns.length) return;
    const body = turns
      .map((t) => (t.role === 'user' ? `### 🧑 You\n\n${t.content}` : `### 🤖 Asta\n\n${t.content}`))
      .join('\n\n---\n\n');
    const md = `# Asta conversation\n\n${body}\n`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-conversation-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Conversation exported');
  }

  /** "Run in Lab" — hand the snippet to the practice panel and open it. */
  protected onRunCode(req: RunCodeRequest): void {
    this.codeHandoff.set({ language: req.language, code: req.code });
    void this.router.navigateByUrl('/app/os/practice');
  }

  protected onMic(): void {
    if (this.sessionMode() === 'chat') this.sessionMode.set('voice');
    this.voice.activate();
  }

  /** Map a route (often a legacy one an agent suggested) to a native tool — never leaves Asta OS. */
  protected openRoute(route: string): void {
    const tool = toolForRoute(route);
    if (tool) this.onOpenTool(tool);
  }

  /** Open a tool: route tools go to an OS page; panel tools open as a dialog. */
  protected onOpenTool(tool: AstaTool): void {
    if (tool.kind === 'route' && tool.route) void this.router.navigateByUrl(tool.route);
    else this.activeTool.set(tool);
  }

  protected onDockTool(id: string): void {
    const tool = toolById(id);
    if (tool) this.onOpenTool(tool);
  }

  protected onOnboard(key: string): void {
    this.dismissOnboard();
    switch (key) {
      case 'voice': this.sessionMode.set('voice'); break;
      case 'face': this.sessionMode.set('face'); break;
      case 'practice': void this.router.navigateByUrl('/app/os/practice'); break;
      case 'roadmap': this.send('Continue my roadmap'); break;
      case 'weak': this.send('Help me fix my weakest topic'); break;
      case 'project': this.send('Help me build a project'); break;
      case 'interview': this.send('Run a mock interview to prepare me'); break;
      default: break; // 'chat' — just open the workspace
    }
  }

  protected dismissOnboard(): void {
    this.showOnboarding.set(false);
    try {
      this.win()?.localStorage?.setItem('asta.os.onboarded', '1');
    } catch {
      /* storage unavailable */
    }
  }

  private firstVisit(): boolean {
    try {
      return this.win()?.localStorage?.getItem('asta.os.onboarded') !== '1';
    } catch {
      return false;
    }
  }

  private win(): (Window & typeof globalThis) | null {
    return typeof window === 'undefined' ? null : window;
  }

  protected mobileGo(n: { kind: 'route' | 'tool' | 'classic'; target: string }): void {
    if (n.kind === 'route') void this.router.navigateByUrl(n.target);
    else if (n.kind === 'tool') this.onDockTool(n.target);
    else {
      this.mode.set('classic');
      void this.router.navigateByUrl('/app/dashboard');
    }
  }

  /** A tool dialog asked Asta something — close it and run in the session. */
  protected onToolAsk(prompt: string): void {
    this.activeTool.set(null);
    this.send(prompt);
  }

  /** Run the deep Cognitive Guardian over an answer (question = preceding user turn). */
  protected onVerify(turn: AstaTurn): void {
    if (turn.verifying || turn.guardian) return;
    const all = this.turns();
    const idx = all.indexOf(turn);
    let question = this.lastPrompt;
    for (let i = idx - 1; i >= 0; i--) {
      if (all[i].role === 'user') { question = all[i].content; break; }
    }
    turn.verifying = true;
    this.bump();
    this.guardian
      .review(question, turn.content)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (v) => { turn.guardian = v; turn.verifying = false; this.bump(); },
        error: () => { turn.verifying = false; this.bump(); this.toast.error('Couldn’t double-check that just now'); },
      });
  }

  protected runAction(a: AgentAction): void {
    if (a.kind === 'open_route') {
      const route = a.payload?.['route'];
      if (typeof route === 'string') this.openRoute(route);
      return;
    }
    const topic = (a.payload?.['topic'] as string | undefined) ?? this.lastPrompt;
    switch (a.kind) {
      case 'simpler': this.send(`Explain ${topic} in a simpler way`); break;
      case 'generate_quiz': this.send(`Quiz me on ${topic}`); break;
      case 'explain_visually': this.send(`Explain ${topic} visually`); break;
      case 'ask_interviewer': this.send(`Interview me on ${topic}`); break;
      default: {
        // Undo chips (and other server-authored actions) carry the exact text to send.
        const sendText = a.payload?.['sendText'];
        this.send(typeof sendText === 'string' ? sendText : a.label);
      }
    }
  }

  private onEvent(e: AgentStreamEvent, asta: AstaTurn): void {
    switch (e.type) {
      case 'started':
        this.sessionId = e.sessionId;
        this.pushActivity(friendlyActivity(e));
        break;
      case 'plan':
      case 'step_started':
      case 'thinking':
      case 'tool_call':
      case 'tool_result':
        this.pushActivity(friendlyActivity(e));
        break;
      case 'chunk':
        asta.content += e.delta;
        this.bump();
        break;
      case 'visual_block':
        asta.blocks = [...asta.blocks, e.block];
        this.bump();
        break;
      case 'completed':
        this.applyResponse(asta, e.response, e.messageId);
        this.completeActivity();
        this.bump();
        this.busy.set(false);
        break;
      case 'step_completed':
        break;
      case 'error':
        this.fail(asta);
        break;
    }
  }

  /** Populate an Asta turn from a synthesized response (used by both stream completion + REST fallback). */
  private applyResponse(asta: AstaTurn, response: AgentResponse, messageId: string): void {
    asta.content = response.answer;
    asta.blocks = response.visualBlocks;
    asta.actions = response.actions;
    asta.followUps = response.followUpQuestions;
    asta.recommended = response.recommendedNextActions;
    asta.sources = response.sources ?? [];
    asta.agentType = response.agentType;
    asta.intent = response.intent;
    asta.confidence = response.confidence;
    asta.messageId = messageId;
    asta.streaming = false;
    if (response.nextAction) this.next.set(response.nextAction);
    // A chat command wrote state → refresh every open screen bound to those domains.
    this.bus.invalidate(response.invalidate);
  }

  private fail(asta: AstaTurn): void {
    asta.streaming = false;
    if (!asta.content) asta.failed = true;
    this.errored.set(true);
    this.completeActivity();
    this.bump();
    this.busy.set(false);
  }

  private pushActivity(label: string | null): void {
    if (!label) return;
    this.activity.update((rows) => {
      const done = rows.map((r) => (r.status === 'active' ? { ...r, status: 'done' as const } : r));
      return [...done, { id: this.activitySeq++, status: 'active', label }];
    });
  }

  private completeActivity(): void {
    this.activity.update((rows) => rows.map((r) => ({ ...r, status: 'done' as const })));
  }

  private lastTurnHasContent(): boolean {
    const t = this.turns();
    const last = t[t.length - 1];
    return !!last && last.role === 'asta' && last.content.length > 0;
  }

  private userTurn(content: string): AstaTurn {
    return { role: 'user', content, blocks: [], actions: [], followUps: [], recommended: [], sources: [], streaming: false, failed: false };
  }
  private astaTurn(): AstaTurn {
    return { role: 'asta', content: '', blocks: [], actions: [], followUps: [], recommended: [], sources: [], streaming: true, failed: false };
  }
  private bump(): void {
    this.turns.update((list) => [...list]);
  }
}
