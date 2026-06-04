import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { SpeechRecognitionService } from '../../core/services/speech-recognition.service';
import { TextToSpeechService } from '../../core/services/text-to-speech.service';
import {
  VOICE_MODE_LIST,
  VOICE_MODE_META,
  VoiceMode,
  VoiceSession,
  VoiceSessionService,
} from '../../core/services/voice-session.service';

type VState = 'idle' | 'listening' | 'thinking' | 'speaking';

@Component({
  selector: 'asta-voice-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ session() ? session()!.title : 'Voice Room' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ session() ? modeMeta(session()!.mode).label + ' · speak to learn' : 'Voice-native learning · 8 modes' }}</span>
        @if (demoVoice()) { <span class="pill ml-2 text-[10px]" style="color:var(--text-mute)">demo · browser speech</span> }
      </div>
      <div class="flex gap-2.5 shrink-0">
        @if (session()) {
          <asta-btn variant="ghost" size="sm" (click)="lobby()">All sessions</asta-btn>
          @if (session()!.status === 'active') { <asta-btn variant="ghost" size="sm" (click)="endSession()">End</asta-btn> }
        }
      </div>
    </header>

    @if (!sessionId()) {
      <!-- ───────── lobby ───────── -->
      <asta-card class="block motion-card-reveal motion-row-primary mb-5">
        <p class="kicker mb-3">Start a voice session</p>
        <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          @for (m of modes; track m) {
            <button class="mode-card" [class.busy]="starting()" (click)="start(m)">
              <span class="mode-glyph">{{ modeMeta(m).glyph }}</span>
              <span class="mode-label">{{ modeMeta(m).label }}</span>
              <span class="mode-blurb">{{ modeMeta(m).blurb }}</span>
            </button>
          }
        </div>
        @if (!sttSupported) {
          <p class="text-xs text-txt-mute mt-3">Your browser doesn't support speech recognition — you can still type; Asta will speak answers aloud.</p>
        }
      </asta-card>

      @if (loading()) {
        <asta-card><asta-skeleton h="80px" /></asta-card>
      } @else if (sessions().length) {
        <div class="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <p class="kicker !mb-0">Recent sessions</p>
          <input class="search" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search sessions…" aria-label="Search sessions" />
        </div>
        <div class="flex flex-wrap gap-1.5 mb-3">
          <button class="fchip" [class.on]="modeFilter() === ''" (click)="modeFilter.set('')">All <span class="ct">{{ sessions().length }}</span></button>
          @for (m of modesPresent(); track m) {
            <button class="fchip" [class.on]="modeFilter() === m" (click)="modeFilter.set(m)">{{ modeMeta(m).label }} <span class="ct">{{ modeCount(m) }}</span></button>
          }
        </div>
        @if (filteredSessions().length) {
          <div class="space-y-2 motion-row-2">
            @for (s of filteredSessions(); track s.id; let i = $index) {
              <asta-card class="motion-card-reveal hover-lift block" [interactive]="true" [style.--motion-card-index]="i % 4">
                <div class="flex items-center gap-3">
                  <span class="mode-glyph sm">{{ modeMeta(s.mode).glyph }}</span>
                  <span class="min-w-0 flex-1 cursor-pointer" (click)="editingId() === s.id ? null : open(s.id)">
                    @if (editingId() === s.id) {
                      <input class="rename-inp" [ngModel]="renameDraft()" (ngModelChange)="renameDraft.set($event)" (keydown.enter)="saveRename(s)" (keydown.escape)="editingId.set(null)" (click)="$event.stopPropagation()" aria-label="Session title" />
                    } @else {
                      <span class="block font-medium truncate">{{ s.title }}</span>
                      <span class="block text-xs text-txt-mute">{{ modeMeta(s.mode).label }} · {{ s.transcript.length }} turns@if (s.durationMs > 0) { · {{ fmtDur(s.durationMs) }} } · {{ ago(s.createdAt) }}</span>
                    }
                  </span>
                  @if (s.linkedFlowId) { <span class="link-pill">→ flow</span> }
                  @if (s.linkedQuizId) { <span class="link-pill">→ quiz</span> }
                  @if (editingId() === s.id) {
                    <button class="icon-btn ok" (click)="saveRename(s); $event.stopPropagation()" title="Save">✓</button>
                    <button class="icon-btn" (click)="editingId.set(null); $event.stopPropagation()" title="Cancel">✕</button>
                  } @else {
                    <button class="icon-btn" (click)="beginRename(s); $event.stopPropagation()" title="Rename">✎</button>
                    <button class="icon-btn del" (click)="remove(s); $event.stopPropagation()" title="Delete">🗑</button>
                  }
                </div>
              </asta-card>
            }
          </div>
        } @else { <p class="text-sm text-txt-mute">No sessions match.</p> }
      }
    } @else {
      <!-- ───────── live session ───────── -->
      @if (loading()) {
        <asta-card><asta-skeleton h="380px" /></asta-card>
      } @else if (!session()) {
        <asta-card><asta-empty-state title="Session not found" description=""><asta-btn variant="accent" (click)="lobby()">Back to Voice Room</asta-btn></asta-empty-state></asta-card>
      } @else {
        <div class="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
          <div class="min-w-0">
            <!-- orb + state + controls -->
            <asta-card class="block motion-card-reveal motion-row-primary text-center">
              <div class="orb-wrap">
                <div class="orb" [class.listening]="state() === 'listening'" [class.thinking]="state() === 'thinking'" [class.speaking]="tts.speaking() || state() === 'speaking'"></div>
              </div>
              <p class="state-label">{{ stateLabel() }}</p>
              @if (interim()) { <p class="interim">“{{ interim() }}”</p> }

              <div class="flex items-center justify-center gap-2.5 mt-3 flex-wrap">
                @if (state() === 'listening') {
                  <asta-btn variant="accent" size="sm" (click)="stopListening()">Stop listening</asta-btn>
                } @else {
                  <asta-btn variant="accent" size="sm" [disabled]="state() === 'thinking'" (click)="startListening()">🎙 {{ sttSupported ? 'Push to talk' : 'Mic unavailable' }}</asta-btn>
                }
                @if (tts.speaking()) { <asta-btn variant="ghost" size="sm" (click)="stopSpeaking()">Stop voice</asta-btn> }
                @if (lastAnswer()) { <asta-btn variant="ghost" size="sm" (click)="replay()">Replay</asta-btn> }
                <button class="auto-toggle" [class.on]="autoRead()" (click)="autoRead.set(!autoRead())">Auto-read {{ autoRead() ? 'on' : 'off' }}</button>
              </div>

              <div class="type-row mt-3">
                <input class="v-input" [(ngModel)]="typed" (keydown.enter)="sendTyped()" placeholder="…or type your turn" [disabled]="state() === 'thinking'" aria-label="Type your turn" />
                <asta-btn variant="ghost" size="sm" [disabled]="!typed.trim() || state() === 'thinking'" (click)="sendTyped()">Send</asta-btn>
              </div>
            </asta-card>

            <!-- transcript -->
            <asta-card class="block motion-card-reveal motion-row-2 mt-4">
              <div class="flex items-center justify-between mb-3">
                <p class="kicker !mb-0">Transcript</p>
                @if (session()!.transcript.length) { <button class="copy-btn" (click)="copyTranscript()">Copy</button> }
              </div>
              @if (session()!.transcript.length === 0) {
                <p class="text-sm text-txt-mute">Tap “Push to talk” (or type) to begin.</p>
              } @else {
                <div class="space-y-2.5">
                  @for (t of session()!.transcript; track $index) {
                    <div class="turn" [class.you]="t.role === 'user'">
                      <span class="turn-who">{{ t.role === 'user' ? 'You' : 'Asta' }}</span>
                      <span class="turn-text">{{ t.text }}</span>
                    </div>
                  }
                </div>
              }
            </asta-card>
          </div>

          <!-- artifacts rail -->
          <div class="space-y-4">
            <asta-card class="block motion-card-reveal motion-row-2">
              <p class="kicker mb-2">Turn this session into…</p>
              <div class="grid gap-2">
                <asta-btn variant="ghost" size="sm" [loading]="busy() === 'flow'" (click)="createFlow()">🧭 A learning flow</asta-btn>
                <asta-btn variant="ghost" size="sm" [loading]="busy() === 'quiz'" (click)="createQuiz()">✓ A quiz</asta-btn>
                <asta-btn variant="ghost" size="sm" [loading]="busy() === 'notes'" (click)="extractNotes()">▤ Notes</asta-btn>
                <asta-btn variant="ghost" size="sm" [loading]="busy() === 'sum'" (click)="summarize()">✦ Summary</asta-btn>
              </div>
            </asta-card>

            @if (session()!.summary) {
              <asta-card class="block motion-card-reveal motion-row-3">
                <p class="kicker mb-1">Summary</p>
                <p class="text-sm text-txt-soft">{{ session()!.summary }}</p>
                @if (session()!.extractedActions.length) {
                  <p class="kicker mt-3 mb-1">Action items</p>
                  <ul class="text-sm text-txt-soft space-y-0.5">
                    @for (a of session()!.extractedActions; track a) { <li>• {{ a }}</li> }
                  </ul>
                }
              </asta-card>
            }

            @if (notes()) {
              <asta-card class="block motion-card-reveal motion-row-3">
                <div class="flex items-center justify-between mb-1">
                  <p class="kicker !mb-0">Notes</p>
                  <button class="copy-btn" (click)="copyNotes()">Copy</button>
                </div>
                <pre class="notes">{{ notes() }}</pre>
              </asta-card>
            }
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .mode-card { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--paper-3); background: var(--paper-2); cursor: pointer; text-align: left; transition: border-color .2s, transform .2s; }
      .mode-card:hover { border-color: var(--green); transform: translateY(-2px); }
      .mode-card.busy { opacity: .6; pointer-events: none; }
      .mode-glyph { font-size: 24px; }
      .mode-glyph.sm { font-size: 20px; }
      .mode-label { font-weight: 600; font-size: 14px; }
      .mode-blurb { font-size: 11px; color: var(--text-mute); }
      .link-pill { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); white-space: nowrap; }
      .orb-wrap { display: grid; place-items: center; height: 140px; }
      .orb { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--green) 55%, transparent), color-mix(in oklab, var(--green-deep) 40%, transparent)); box-shadow: 0 0 30px color-mix(in oklab, var(--green) 35%, transparent); transition: transform .3s var(--ease); }
      .orb.listening { animation: orbPulse 1.1s ease-in-out infinite; box-shadow: 0 0 44px color-mix(in oklab, var(--green) 60%, transparent); }
      .orb.thinking { animation: orbSpin 1.4s linear infinite; background: conic-gradient(from 0deg, color-mix(in oklab, var(--peri,#8aa6ff) 60%, transparent), transparent 70%); }
      .orb.speaking { animation: orbPulse .6s ease-in-out infinite; }
      @keyframes orbPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
      @keyframes orbSpin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .orb, .orb.listening, .orb.thinking, .orb.speaking { animation: none; } }
      .state-label { font-size: 13px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .06em; }
      .interim { font-size: 14px; color: var(--text-soft); font-style: italic; margin-top: 4px; }
      .auto-toggle { font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--paper-3); background: transparent; color: var(--text-mute); cursor: pointer; }
      .auto-toggle.on { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); }
      .type-row { display: flex; gap: 8px; align-items: center; max-width: 440px; margin: 0 auto; }
      .v-input { flex: 1; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 9px 12px; color: var(--text); font-size: 14px; }
      .v-input:focus { outline: none; border-color: var(--green); }
      .turn { display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border-radius: 12px; background: var(--paper-2); border: 1px solid var(--paper-3); }
      .turn.you { background: color-mix(in oklab, var(--green) 8%, var(--paper-2)); }
      .turn-who { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-mute); }
      .turn-text { font-size: 14px; }
      .copy-btn { font-size: 11px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--paper-3); background: transparent; color: var(--peri,#8aa6ff); cursor: pointer; }
      .search { background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 11px; padding: 7px 11px; color: var(--text); font-size: 13px; min-width: 180px; }
      .search:focus { outline: none; border-color: var(--green); }
      .fchip { font-size: 11.5px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-mute); cursor: pointer; transition: all .12s; }
      .fchip:hover { color: var(--text-soft); }
      .fchip.on { background: color-mix(in oklab, var(--green) 14%, transparent); color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 38%, transparent); }
      .fchip .ct { font-weight: 700; opacity: .8; }
      .icon-btn { font-size: 13px; line-height: 1; padding: 5px 7px; border-radius: 9px; border: 1px solid transparent; background: transparent; color: var(--text-mute); cursor: pointer; transition: color .12s, border-color .12s; }
      .icon-btn:hover { color: var(--text); border-color: var(--paper-3); }
      .icon-btn.del:hover { color: var(--danger, #ff5d5d); border-color: color-mix(in oklab, var(--danger, #ff5d5d) 40%, transparent); }
      .icon-btn.ok { color: var(--green-deep); }
      .rename-inp { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--green); border-radius: 9px; padding: 6px 9px; color: var(--text); font-size: 14px; font-weight: 600; }
      .rename-inp:focus { outline: none; }
      .notes { font-size: 12px; white-space: pre-wrap; color: var(--text-soft); max-height: 240px; overflow: auto; margin: 0; }
    `,
  ],
})
export class VoiceRoomComponent implements OnDestroy {
  private readonly api = inject(VoiceSessionService);
  private readonly stt = inject(SpeechRecognitionService);
  readonly tts = inject(TextToSpeechService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private sub?: Subscription;

  readonly modes = VOICE_MODE_LIST;
  readonly sttSupported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  readonly sessionId = signal<string | null>(null);
  readonly session = signal<VoiceSession | null>(null);
  readonly sessions = signal<VoiceSession[]>([]);
  readonly loading = signal(false);
  readonly starting = signal(false);
  readonly state = signal<VState>('idle');
  readonly interim = signal('');
  readonly lastAnswer = signal('');
  readonly autoRead = signal(true);
  readonly busy = signal<'flow' | 'quiz' | 'notes' | 'sum' | null>(null);
  readonly notes = signal('');
  /** True until the server reports a live TTS provider — mic + speech run in-browser. */
  readonly demoVoice = signal(true);
  typed = '';

  // lobby session management
  readonly query = signal('');
  readonly modeFilter = signal<VoiceMode | ''>('');
  readonly editingId = signal<string | null>(null);
  readonly renameDraft = signal('');

  readonly modesPresent = computed(() => {
    const set = new Set(this.sessions().map((s) => s.mode));
    return VOICE_MODE_LIST.filter((m) => set.has(m));
  });
  readonly filteredSessions = computed(() => {
    const q = this.query().trim().toLowerCase();
    const mf = this.modeFilter();
    let out = this.sessions();
    if (mf) out = out.filter((s) => s.mode === mf);
    if (q) out = out.filter((s) => s.title.toLowerCase().includes(q) || s.mode.toLowerCase().includes(q));
    return out;
  });

  private readonly startedAt = Date.now();

  readonly stateLabel = computed(() => {
    switch (this.state()) {
      case 'listening': return 'Listening…';
      case 'thinking': return 'Asta is thinking…';
      case 'speaking': return 'Speaking…';
      default: return this.tts.speaking() ? 'Speaking…' : 'Ready';
    }
  });

  constructor() {
    this.sub = this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      this.sessionId.set(id);
      if (id) this.loadSession(id);
      else this.loadLobby();
    });
    this.api.status().subscribe({ next: (s) => this.demoVoice.set(!s.serverTts) });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.stt.abort();
    this.tts.cancel();
  }

  modeMeta(m: VoiceMode) { return VOICE_MODE_META[m]; }

  private loadLobby(): void {
    this.session.set(null);
    this.loading.set(true);
    this.api.list().subscribe({
      next: (l) => { this.sessions.set(l); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadSession(id: string): void {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (s) => { this.session.set(s); this.loading.set(false); },
      error: () => { this.session.set(null); this.loading.set(false); },
    });
  }

  start(mode: VoiceMode): void {
    this.starting.set(true);
    this.api.create(mode).subscribe({
      next: (s) => { this.starting.set(false); this.router.navigate(['/app/voice-room/session', s.id]); },
      error: (e: Error) => { this.starting.set(false); this.toast.error(e.message || 'Could not start session'); },
    });
  }

  open(id: string): void { this.router.navigate(['/app/voice-room/session', id]); }
  lobby(): void { this.router.navigate(['/app/voice-room']); }

  // ── lobby session management ──
  modeCount(m: VoiceMode): number { return this.sessions().filter((s) => s.mode === m).length; }
  ago(iso: string): string {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
  }
  fmtDur(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
  }
  beginRename(s: VoiceSession): void { this.editingId.set(s.id); this.renameDraft.set(s.title); }
  saveRename(s: VoiceSession): void {
    const title = this.renameDraft().trim();
    this.editingId.set(null);
    if (!title || title === s.title) return;
    this.api.rename(s.id, title).subscribe({
      next: (u) => this.sessions.set(this.sessions().map((x) => (x.id === u.id ? u : x))),
      error: () => this.toast.error('Could not rename'),
    });
  }
  remove(s: VoiceSession): void {
    this.api.remove(s.id).subscribe({
      next: () => { this.sessions.set(this.sessions().filter((x) => x.id !== s.id)); this.toast.success('Session deleted'); },
      error: () => this.toast.error('Could not delete'),
    });
  }
  copyTranscript(): void {
    const s = this.session(); if (!s) return;
    const text = s.transcript.map((t) => `${t.role === 'user' ? 'You' : 'Asta'}: ${t.text}`).join('\n\n');
    navigator.clipboard?.writeText(text).then(() => this.toast.success('Transcript copied'), () => this.toast.error('Clipboard unavailable'));
  }

  // ── speech ──
  startListening(): void {
    if (!this.sttSupported) { this.toast.info('Speech recognition unavailable — type instead'); return; }
    this.state.set('listening');
    this.interim.set('');
    this.stt.start({
      interimResults: true,
      lang: 'en-US',
      onResult: (text, isFinal) => {
        this.interim.set(text);
        if (isFinal && text.trim()) { this.stt.stop(); this.interim.set(''); this.send(text.trim()); }
      },
      onError: (c) => { this.state.set('idle'); this.toast.error(`Mic: ${c}`); },
      onEnd: () => { if (this.state() === 'listening') this.state.set('idle'); },
    });
  }

  stopListening(): void { this.stt.stop(); this.state.set('idle'); }

  sendTyped(): void {
    const t = this.typed.trim();
    if (!t) return;
    this.typed = '';
    this.send(t);
  }

  private send(text: string): void {
    const s = this.session();
    if (!s) return;
    this.session.set({ ...s, transcript: [...s.transcript, { role: 'user', text, at: new Date().toISOString() }] });
    this.state.set('thinking');
    this.api.turn(s.id, text).subscribe({
      next: (res) => {
        const cur = this.session();
        if (cur) this.session.set({ ...cur, transcript: [...cur.transcript, { role: 'assistant', text: res.text, at: new Date().toISOString() }] });
        this.lastAnswer.set(res.text);
        if (this.autoRead() && res.speak?.audioUrl) {
          // Live server TTS — play the real audio.
          this.state.set('speaking');
          const audio = new Audio(res.speak.audioUrl);
          audio.onended = audio.onerror = () => this.state.set('idle');
          void audio.play().catch(() => this.state.set('idle'));
        } else if (this.autoRead() && this.tts.supported) {
          this.state.set('speaking');
          this.tts.speak(res.text).then(() => this.state.set('idle'));
        } else {
          this.state.set('idle');
        }
      },
      error: (e: Error) => { this.state.set('idle'); this.toast.error(e.message || 'Could not get a response'); },
    });
  }

  replay(): void { if (this.lastAnswer()) this.tts.speak(this.lastAnswer()); }
  stopSpeaking(): void { this.tts.cancel(); if (this.state() === 'speaking') this.state.set('idle'); }

  // ── artifacts ──
  summarize(): void {
    const s = this.session(); if (!s) return;
    this.busy.set('sum');
    this.api.summarize(s.id).subscribe({ next: (u) => { this.session.set(u); this.busy.set(null); this.toast.success('Summarized'); }, error: () => { this.busy.set(null); this.toast.error('Could not summarize'); } });
  }
  createFlow(): void {
    const s = this.session(); if (!s) return;
    this.busy.set('flow');
    this.api.createFlow(s.id).subscribe({ next: (r) => { this.busy.set(null); this.toast.success('Flow created from your session'); this.router.navigate(['/app/flows', r.flowId]); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Could not create flow'); } });
  }
  createQuiz(): void {
    const s = this.session(); if (!s) return;
    this.busy.set('quiz');
    this.api.createQuiz(s.id).subscribe({ next: (r) => { this.busy.set(null); this.toast.success('Quiz created'); this.router.navigate(['/app/quizzes'], { queryParams: { quizId: r.quizId } }); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Could not create quiz'); } });
  }
  extractNotes(): void {
    const s = this.session(); if (!s) return;
    this.busy.set('notes');
    this.api.extractNotes(s.id).subscribe({ next: (r) => { this.notes.set(r.notes); this.busy.set(null); this.toast.success('Notes extracted'); }, error: () => { this.busy.set(null); this.toast.error('Could not extract notes'); } });
  }
  copyNotes(): void { navigator.clipboard?.writeText(this.notes()).then(() => this.toast.success('Notes copied'), () => this.toast.error('Clipboard unavailable')); }

  endSession(): void {
    const s = this.session(); if (!s) return;
    this.stt.abort(); this.tts.cancel();
    this.api.end(s.id, Date.now() - this.startedAt).subscribe({ next: (u) => { this.session.set(u); this.toast.success('Session ended'); }, error: () => this.toast.error('Could not end session') });
  }
}
