import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgentAction } from '../../core/models';
import { RichContentComponent, RunCodeRequest } from '../../shared/components/ai/rich-content.component';
import { VisualBlockRendererComponent } from '../../shared/components/ai/visual-block-renderer.component';

export type ExplainKind = 'simpler' | 'analogy' | 'examples' | 'visualize';
export type TransformKind = 'quiz' | 'flashcards' | 'diagram';
import { AstaOsOrbComponent } from './asta-os-orb.component';
import { AstaOsTrustBadgesComponent } from './asta-os-trust-badges.component';
import { AstaOsToolSuggestionsComponent } from './asta-os-tool-suggestions.component';
import { AstaTool, suggestTools } from './asta-os-tools';
import { agentLabel, deriveTrustBadges, intentLabel } from './asta-os.constants';
import { GuardianVerdict, GuardianVerdictKind } from '../../core/models';
import { AstaTrustBadge, AstaTurn } from './asta-os.types';

/**
 * The living session thread. Renders each turn — markdown answer + any
 * structured VisualBlocks (delegated to the shared asta-ai-visual-block renderer) —
 * plus follow-up chips, quick actions and recommended next steps. Emits the
 * prompt/action the learner taps; the shell owns sending it.
 */
@Component({
  selector: 'asta-os-learning-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RichContentComponent, VisualBlockRendererComponent, AstaOsOrbComponent, AstaOsTrustBadgesComponent, AstaOsToolSuggestionsComponent],
  template: `
    <div class="thread">
      @for (turn of turns(); track $index) {
        @if (turn.role === 'user') {
          <div class="row user" [class.dim]="dimmed(turn)" [class.match]="matched(turn)">
            <div class="bubble">
              {{ turn.content }}
              <button type="button" class="edit-btn" (click)="editTurn.emit(turn)" aria-label="Edit & resend" title="Edit & resend">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
            </div>
          </div>
        } @else {
          <div class="row asta" [class.dim]="dimmed(turn)" [class.match]="matched(turn)">
            <div class="avatar"><asta-os-orb size="sm" [state]="turn.streaming ? 'thinking' : 'idle'" /></div>
            <div class="body">
              @if (turn.streaming && !turn.content) {
                <div class="skeleton" aria-label="Asta is responding">
                  <span style="width:92%"></span><span style="width:76%"></span><span style="width:58%"></span>
                </div>
              } @else {
                <asta-rich-content class="prose" [text]="turn.content" [streaming]="!!turn.streaming" (runCode)="runCode.emit($event)" />
              }

              @for (block of turn.blocks; track $index) {
                <div class="block"><asta-ai-visual-block [block_]="block" /></div>
              }

              @if (turn.sources.length) {
                <details class="sources">
                  <summary>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /></svg>
                    Grounded in {{ turn.sources.length }} of your source{{ turn.sources.length === 1 ? '' : 's' }}
                  </summary>
                  <ul>
                    @for (s of turn.sources; track s.documentId + (s.chunkId ?? '')) {
                      <li><span class="s-title">{{ s.title }}</span><span class="s-snip">{{ s.snippet }}</span></li>
                    }
                  </ul>
                </details>
              }

              @if (turn.failed) {
                <div class="err">
                  <span>That response didn’t complete.</span>
                  <button type="button" (click)="retry.emit()">Retry</button>
                </div>
              }

              @if (!turn.streaming && !turn.failed) {
                <asta-os-trust-badges [badges]="badges(turn)" />

                <div class="meta">
                  <span class="who">{{ label(turn) }}</span>
                  @if (phrase(turn); as p) { <span class="dot-sep">·</span><span class="intent">Asta is {{ p }}</span> }
                  @if (turn.confidence) { <span class="dot-sep">·</span><span class="conf">{{ confidencePct(turn) }}% sure</span> }
                  <span class="spacer"></span>
                  <button type="button" class="fb" [class.on]="turn.feedback === 'up'" [disabled]="!!turn.feedback" (click)="feedback.emit({ turn, rating: 'up' })" aria-label="Helpful">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
                  </button>
                  <button type="button" class="fb" [class.on]="turn.feedback === 'down'" [disabled]="!!turn.feedback" (click)="feedback.emit({ turn, rating: 'down' })" aria-label="Not helpful">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(180deg)"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
                  </button>
                  @if (!turn.guardian && turn.content) {
                    <button type="button" class="dc" [disabled]="turn.verifying" (click)="verify.emit(turn)">
                      {{ turn.verifying ? 'Checking…' : 'Double-check' }}
                    </button>
                  }
                  <button type="button" class="mact" (click)="readAloud.emit(turn)" [class.on]="turn.messageId && turn.messageId === readingId()" aria-label="Read aloud">
                    {{ turn.messageId && turn.messageId === readingId() ? 'Stop' : 'Read aloud' }}
                  </button>
                  <button type="button" class="mact" (click)="copy.emit(turn)" aria-label="Copy answer">Copy</button>
                  <button type="button" class="mact" (click)="regenerate.emit(turn)" aria-label="Regenerate">Regenerate</button>
                  <button type="button" class="mact" (click)="saveNote.emit(turn)" aria-label="Save to notes">Save</button>
                </div>

                @if (turn.content) {
                  <div class="chips soft explain">
                    <span class="ex-label">Explain differently:</span>
                    <button type="button" class="chip ghost" (click)="explain.emit({ turn, kind: 'simpler' })">Simpler</button>
                    <button type="button" class="chip ghost" (click)="explain.emit({ turn, kind: 'analogy' })">With an analogy</button>
                    <button type="button" class="chip ghost" (click)="explain.emit({ turn, kind: 'examples' })">More examples</button>
                    <button type="button" class="chip ghost" (click)="explain.emit({ turn, kind: 'visualize' })">Visualize it</button>
                  </div>
                  <div class="chips soft explain">
                    <span class="ex-label">Turn this into:</span>
                    <button type="button" class="chip ghost" (click)="transform.emit({ turn, kind: 'quiz' })">A quiz</button>
                    <button type="button" class="chip ghost" (click)="transform.emit({ turn, kind: 'flashcards' })">Flashcards</button>
                    <button type="button" class="chip ghost" (click)="transform.emit({ turn, kind: 'diagram' })">A diagram</button>
                  </div>
                }

                @if (turn.guardian; as g) {
                  <div class="guardian" [attr.data-v]="g.verdict">
                    <div class="g-head">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
                      <span class="g-label">{{ guardianLabel(g.verdict) }}</span>
                      <span class="g-conf">{{ guardianPct(g) }}% confident</span>
                    </div>
                    @if (g.concerns.length) {
                      <ul class="g-concerns">@for (c of g.concerns; track c) { <li>{{ c }}</li> }</ul>
                    }
                    <p class="g-sug">{{ g.suggestion }}</p>
                  </div>
                }

                <asta-os-tool-suggestions [tools]="tools(turn)" (open)="openTool.emit($event)" />

                @if (genericActions(turn).length) {
                  <div class="chips">
                    @for (a of genericActions(turn); track a.id) { <button type="button" class="chip" (click)="action.emit(a)">{{ a.label }}</button> }
                  </div>
                }
                @if (turn.followUps.length || turn.recommended.length) {
                  <div class="chips soft">
                    @for (f of turn.followUps.slice(0, 3); track f) { <button type="button" class="chip ghost" (click)="ask.emit(f)">{{ f }}</button> }
                    @for (r of turn.recommended.slice(0, 2); track r) { <button type="button" class="chip ghost" (click)="ask.emit(r)">→ {{ r }}</button> }
                  </div>
                }
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .thread { display: flex; flex-direction: column; gap: 22px; }
      .row { display: flex; gap: 12px; animation: turnIn .3s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes turnIn { from { opacity: 0; transform: translateY(8px); } }
      @media (prefers-reduced-motion: reduce) { .row { animation: none; } }
      .row.user { justify-content: flex-end; }
      .row.dim { opacity: .32; transition: opacity .2s ease; }
      .row.match { opacity: 1; }
      .row.match .bubble, .row.match .body { outline: 2px solid color-mix(in srgb, var(--asta-gold, #e8c170) 70%, transparent); outline-offset: 3px; border-radius: 14px; }
      .bubble { position: relative; max-width: 80%; padding: 11px 16px; border-radius: 16px 16px 4px 16px; font-size: 15px; line-height: 1.5; color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); }
      .bubble:hover .edit-btn { opacity: 1; }
      .edit-btn { position: absolute; top: -9px; left: -9px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: var(--asta-panel-strong); border: 1px solid var(--asta-border); color: var(--asta-muted); opacity: 0; transition: opacity .15s ease, color .15s ease; }
      .edit-btn:hover { color: var(--asta-green); }
      .avatar { flex-shrink: 0; padding-top: 2px; }
      .body { min-width: 0; flex: 1; }
      .block { margin-top: 12px; }

      .skeleton { display: flex; flex-direction: column; gap: 8px; }
      .skeleton span { height: 11px; border-radius: 6px; background: linear-gradient(100deg, var(--asta-panel) 30%, color-mix(in srgb, var(--asta-green) 18%, transparent) 50%, var(--asta-panel) 70%); background-size: 220% 100%; animation: sh 1.4s ease infinite; }
      @keyframes sh { 0% { background-position: 180% 0; } 100% { background-position: -40% 0; } }
      @media (prefers-reduced-motion: reduce) { .skeleton span { animation: none; } }

      .err { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 13px; color: var(--asta-coral); }
      .err button { font-size: 12px; padding: 4px 12px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--asta-green) 40%, transparent); color: var(--asta-green); }

      .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .chips.soft { margin-top: 8px; }
      .chip { font-size: 12.5px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--asta-border); background: var(--asta-panel); color: var(--asta-text); transition: transform .14s ease, border-color .14s ease; }
      .chip.ghost { background: transparent; color: var(--asta-muted); }
      .chip:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); color: var(--asta-text); }

      .prose { font-size: 15px; line-height: 1.6; color: var(--asta-text); }
      .prose :is(h1, h2, h3) { font-family: var(--display); margin: 6px 0 8px; }
      .prose :is(p) { margin: 6px 0; }
      .prose :is(ul, ol) { margin: 6px 0; padding-left: 20px; }
      .prose :is(code) { font-family: var(--mono); background: var(--asta-panel-strong); padding: 1px 5px; border-radius: 5px; font-size: 13px; }
      .prose :is(pre) { background: var(--asta-bg); padding: 12px 14px; border-radius: 12px; overflow: auto; border: 1px solid var(--asta-border); }
      .prose :is(a) { color: var(--asta-cyan); text-decoration: underline; }

      .sources { margin-top: 12px; font-size: 13px; }
      .sources summary { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; color: var(--asta-cyan); font-family: var(--mono); font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; list-style: none; }
      .sources summary::-webkit-details-marker { display: none; }
      .sources ul { margin: 10px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
      .sources li { display: flex; flex-direction: column; gap: 2px; padding: 9px 11px; border-radius: 10px; background: var(--asta-panel); border: 1px solid var(--asta-border); }
      .s-title { font-weight: 600; color: var(--asta-text); font-size: 13px; }
      .s-snip { color: var(--asta-muted); font-size: 12.5px; line-height: 1.45; }

      .meta { display: flex; align-items: center; gap: 7px; margin-top: 12px; font-family: var(--mono); font-size: 11px; color: var(--asta-subtle); }
      .meta .who { color: var(--asta-muted); }
      .meta .conf { color: var(--asta-green); }
      .meta .spacer { flex: 1; }
      .meta .fb { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--asta-subtle); transition: color .15s ease, background .15s ease; }
      .meta .fb:hover:not(:disabled) { color: var(--asta-text); background: var(--asta-panel); }
      .meta .fb.on { color: var(--asta-green); }
      .meta .fb:disabled { cursor: default; }
      .meta .dc { font-family: var(--mono); font-size: 11px; color: var(--asta-cyan); padding: 3px 9px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--asta-cyan) 35%, transparent); }
      .meta .dc:hover:not(:disabled) { background: color-mix(in srgb, var(--asta-cyan) 12%, transparent); }
      .meta .dc:disabled { opacity: .6; cursor: default; }
      .meta .mact { font-family: var(--mono); font-size: 11px; color: var(--asta-subtle); padding: 3px 8px; border-radius: 999px; border: 1px solid var(--asta-border); }
      .meta .mact:hover { color: var(--asta-text); background: var(--asta-panel); }
      .meta .mact.on { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); }
      .explain { align-items: center; }
      .explain .ex-label { font-family: var(--mono); font-size: 11px; color: var(--asta-subtle); margin-right: 2px; }

      .guardian { margin-top: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--asta-border); background: var(--asta-panel); animation: turnIn .3s ease both; }
      .guardian[data-v='solid'] { border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .guardian[data-v='careful'] { border-color: color-mix(in srgb, var(--asta-gold) 40%, transparent); }
      .guardian[data-v='uncertain'] { border-color: color-mix(in srgb, var(--asta-coral) 40%, transparent); }
      .g-head { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; }
      .guardian[data-v='solid'] .g-head { color: var(--asta-green); }
      .guardian[data-v='careful'] .g-head { color: var(--asta-gold); }
      .guardian[data-v='uncertain'] .g-head { color: var(--asta-coral); }
      .g-conf { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--asta-muted); font-weight: 400; }
      .g-concerns { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
      .g-concerns li { font-size: 12.5px; color: var(--asta-muted); }
      .g-sug { margin-top: 8px; font-size: 13px; color: var(--asta-text); }
    `,
  ],
})
export class AstaOsLearningCanvasComponent {
  readonly turns = input.required<readonly AstaTurn[]>();
  readonly ask = output<string>();
  readonly action = output<AgentAction>();
  readonly retry = output<void>();
  readonly feedback = output<{ turn: AstaTurn; rating: 'up' | 'down' }>();
  readonly openTool = output<AstaTool>();
  readonly verify = output<AstaTurn>();
  readonly copy = output<AstaTurn>();
  readonly regenerate = output<AstaTurn>();
  readonly saveNote = output<AstaTurn>();
  readonly explain = output<{ turn: AstaTurn; kind: ExplainKind }>();
  readonly transform = output<{ turn: AstaTurn; kind: TransformKind }>();
  readonly readAloud = output<AstaTurn>();
  readonly runCode = output<RunCodeRequest>();
  readonly editTurn = output<AstaTurn>();
  /** messageId of the turn currently being read aloud (for the play/stop toggle). */
  readonly readingId = input<string | null>(null);
  /** In-conversation search query — matching turns highlight, others dim. */
  readonly query = input<string>('');

  protected matched(turn: AstaTurn): boolean {
    const q = this.query().trim().toLowerCase();
    return !!q && turn.content.toLowerCase().includes(q);
  }
  protected dimmed(turn: AstaTurn): boolean {
    return !!this.query().trim() && !this.matched(turn);
  }

  private readonly verdictLabels: Record<GuardianVerdictKind, string> = {
    solid: 'Checked by Asta — looks solid',
    careful: 'Checked — mostly right, mind the caveats',
    uncertain: 'Checked — verify before trusting',
  };
  protected guardianLabel(v: GuardianVerdictKind): string {
    return this.verdictLabels[v];
  }
  protected guardianPct(g: GuardianVerdict): number {
    return Math.round(g.confidence * 100);
  }

  protected label(turn: AstaTurn): string {
    return agentLabel(turn.agentType);
  }
  protected phrase(turn: AstaTurn): string | null {
    return intentLabel(turn.intent);
  }
  protected confidencePct(turn: AstaTurn): number {
    return Math.round((turn.confidence ?? 0) * 100);
  }
  protected badges(turn: AstaTurn): AstaTrustBadge[] {
    return deriveTrustBadges(turn);
  }
  protected tools(turn: AstaTurn): AstaTool[] {
    return suggestTools(turn);
  }
  protected genericActions(turn: AstaTurn): AgentAction[] {
    return turn.actions.filter((a) => a.kind !== 'open_route');
  }
}
