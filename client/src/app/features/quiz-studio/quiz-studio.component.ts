import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { KnowledgeService } from '../../core/services/knowledge.service';
import { QuizService } from '../../core/services/quiz.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfettiService } from '../../core/services/confetti.service';
import {
  AttemptView,
  Difficulty,
  KnowledgeDoc,
  QuizAnswer,
  QuizSource,
  QuizStats,
  QuizSummary,
  SubmitResult,
  TakeQuiz,
  VisualBlock,
  WeaknessAnalysisBlock,
} from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { VisualBlockRendererComponent } from '../../shared/components/ai/visual-block-renderer.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { CountDirective } from '../../shared/directives/count.directive';

type View = 'home' | 'take' | 'result';
const SOURCES: { key: QuizSource; label: string; hint: string }[] = [
  { key: 'topic', label: 'A topic', hint: 'Type any topic to be quizzed on' },
  { key: 'document', label: 'My document', hint: 'Grounded in a doc you uploaded' },
  { key: 'weak_area', label: 'My weak areas', hint: 'Drill the gaps in your profile' },
  { key: 'roadmap', label: 'My roadmap', hint: 'This week’s focus topics' },
];
const DIFFS: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

@Component({
  selector: 'asta-quiz-studio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, ButtonComponent, RingComponent, CardComponent, EmptyStateComponent,
    SkeletonComponent, VisualBlockRendererComponent, MagneticDirective, CountDirective,
  ],
  template: `
    <!-- Compact command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Quiz Studio</h1>
        <span class="goal-pill"><span class="dot"></span>Mastery arena · drill weak spots, prove your gains</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        @if (view() !== 'home') { <asta-btn variant="ghost" size="sm" (click)="backHome()">Back to studio</asta-btn> }
      </div>
    </header>

    @switch (view()) {
      @case ('home') {
        @if (loading()) {
          <!-- Loading skeleton -->
          <div class="space-y-5">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              @for (i of [1, 2, 3, 4]; track i) {
                <asta-card class="stat-card"><asta-skeleton h="30px" w="50%" /><div class="mt-2"><asta-skeleton h="11px" w="70%" /></div></asta-card>
              }
            </div>
            <asta-card><asta-skeleton h="20px" w="40%" /><div class="mt-4"><asta-skeleton h="120px" /></div></asta-card>
            <asta-card><asta-skeleton h="20px" w="40%" /><div class="mt-4 space-y-2"><asta-skeleton h="44px" /><asta-skeleton h="44px" /></div></asta-card>
          </div>
        } @else if (loadError()) {
          <!-- Error + retry -->
          <asta-card class="block motion-card-reveal motion-row-primary">
            <asta-empty-state title="Could not load the arena" description="Something went wrong fetching your quizzes and stats. Give it another go.">
              <asta-btn variant="accent" astaMagnetic (click)="refresh()">Retry</asta-btn>
            </asta-empty-state>
          </asta-card>
        } @else {
        <div class="space-y-5">
          <!-- stats — one reveal family (.motion-row-primary) -->
          @if (stats(); as s) {
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 motion-row-primary mb-3.75">
              <asta-card class="stat-card motion-card-reveal" style="--motion-card-index:0">
                <p class="font-display text-2xl"><span [astaCount]="s.quizzes"></span></p><p class="lbl">Quizzes</p>
              </asta-card>
              <asta-card class="stat-card motion-card-reveal" style="--motion-card-index:1">
                <p class="font-display text-2xl"><span [astaCount]="s.attempts"></span></p><p class="lbl">Attempts</p>
              </asta-card>
              <asta-card class="stat-card motion-card-reveal" style="--motion-card-index:2">
                <p class="font-display text-2xl"><span [astaCount]="s.averageScore" suffix="%"></span></p><p class="lbl">Avg score</p>
              </asta-card>
              <asta-card class="stat-card motion-card-reveal" style="--motion-card-index:3">
                <p class="font-display text-2xl"><span [astaCount]="s.weakTopics.length"></span></p><p class="lbl">Weak topics</p>
              </asta-card>
            </div>
            @if (s.masteredTopics.length) {
              <asta-card class="motion-card-reveal mb-3.75" style="--motion-card-index:4">
                <p class="kicker mb-2">Mastered topics</p>
                <div class="mt-chips">@for (t of s.masteredTopics; track t) { <span class="mt-chip">✓ {{ t }}</span> }</div>
              </asta-card>
            }
          }

          <!-- generate -->
          <asta-card class="motion-card-reveal motion-strip" style="--motion-card-index:0">
            <div class="panel-head mb-3">
              <p class="kicker">Generate a quiz</p>
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg>
              </span>
            </div>
            <div class="src-grid mb-3">
              @for (src of sources; track src.key) {
                <button class="src" [class.src-on]="source() === src.key" [attr.aria-pressed]="source() === src.key" (click)="source.set(src.key)">
                  <span class="font-medium">{{ src.label }}</span>
                  <span class="block text-[11px] text-txt-mute">{{ src.hint }}</span>
                </button>
              }
            </div>

            @if (source() === 'topic') {
              <input class="input mb-3" placeholder="e.g. recursion, SQL joins, React hooks" [(ngModel)]="topic" />
            }
            @if (source() === 'document') {
              @if (readyDocs().length) {
                <select class="input mb-3" [(ngModel)]="documentId">
                  <option value="">Select a document…</option>
                  @for (d of readyDocs(); track d.id) { <option [value]="d.id">{{ d.title }}</option> }
                </select>
              } @else {
                <p class="text-sm text-txt-mute mb-3">No ready documents — add one in the Knowledge Hub first.</p>
              }
            }
            @if (source() === 'weak_area') { <p class="text-sm text-txt-soft mb-3">I’ll build a drill from the weak areas in your profile (and your goal if none are set).</p> }
            @if (source() === 'roadmap') { <p class="text-sm text-txt-soft mb-3">I’ll quiz you on your active roadmap’s current-week topics.</p> }

            <div class="flex flex-wrap items-center gap-3">
              <div class="flex gap-1.5">
                @for (d of diffs; track d) {
                  <button class="pill" [class.pill-on]="difficulty() === d" [attr.aria-pressed]="difficulty() === d" (click)="difficulty.set(d)">{{ d }}</button>
                }
                <button class="pill" [class.pill-on]="difficulty() === null" [attr.aria-pressed]="difficulty() === null" (click)="difficulty.set(null)">adaptive</button>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="text-txt-mute">Questions</span>
                <input type="number" class="input" style="width:70px" min="3" max="15" [(ngModel)]="count" />
              </div>
              <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" [ngModel]="timed()" (ngModelChange)="timed.set($event)" /> Timed
              </label>
              @if (timed()) {
                <div class="flex items-center gap-2 text-sm">
                  <input type="number" class="input" style="width:64px" min="1" max="90" [(ngModel)]="limitMin" />
                  <span class="text-txt-mute">min</span>
                </div>
              }
              <label class="flex items-center gap-2 text-sm cursor-pointer select-none" title="Randomize question and answer-option order each attempt">
                <input type="checkbox" [ngModel]="shuffle()" (ngModelChange)="shuffle.set($event)" /> Shuffle
              </label>
              <asta-btn variant="accent" size="sm" astaMagnetic [loading]="generating()" [disabled]="!canGenerate()" (click)="generate()">Generate quiz <span class="arr">→</span></asta-btn>
            </div>
          </asta-card>

          <!-- library -->
          <asta-card class="motion-card-reveal motion-lower" style="--motion-card-index:0">
            <div class="panel-head mb-3">
              <p class="kicker">Your quizzes</p>
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </span>
            </div>
            @if (quizzes().length === 0) {
              <asta-empty-state title="No quizzes yet" description="Generate your first drill above — pick a topic, your weak areas, a roadmap week, or one of your documents, and prove your gains.">
                <asta-btn variant="accent" size="sm" astaMagnetic (click)="scrollToGenerate()">Generate a quiz <span class="arr">→</span></asta-btn>
              </asta-empty-state>
            } @else {
              @if (quizzes().length > 4) {
                <div class="qz-toolbar">
                  <input class="qz-search" [ngModel]="quizQuery()" (ngModelChange)="quizQuery.set($event)" placeholder="Search quizzes…" aria-label="Search quizzes" />
                  <div class="qz-chips">
                    <button class="chip" [class.chip-on]="quizSource() === 'all'" (click)="quizSource.set('all')">all</button>
                    @for (sc of quizSources(); track sc) {
                      <button class="chip" [class.chip-on]="quizSource() === sc" (click)="quizSource.set(sc)">{{ sc }}</button>
                    }
                  </div>
                </div>
              }
              <div class="space-y-2">
                @for (q of filteredQuizzes(); track q.id) {
                  <div class="row">
                    <div class="min-w-0">
                      <p class="text-sm font-medium truncate">{{ q.title }}</p>
                      <p class="text-[11px] text-txt-mute">{{ q.difficulty }} · {{ q.questionCount }} Q · {{ q.source }}@if (q.attemptCount) { · best {{ q.bestScore }}% }</p>
                    </div>
                    @if (q.attemptCount) { <button class="hist-btn" (click)="toggleHistory(q.id)">{{ historyFor() === q.id ? 'Hide' : 'History' }}</button> }
                    <asta-btn variant="ghost" size="sm" (click)="startQuiz(q.id)">{{ q.attemptCount ? 'Retake' : 'Take' }} <span class="arr">→</span></asta-btn>
                  </div>
                  @if (historyFor() === q.id) {
                    <div class="hist">
                      @if (historyLoading()) { <p class="hist-empty">Loading…</p> }
                      @else {
                        @for (a of historyAttempts(); track a.id) {
                          <div class="hist-row"><span>{{ relTime(a.createdAt) }}</span><span class="hist-score" [style.color]="a.score >= 70 ? 'var(--green-deep)' : 'var(--coral, #ffb454)'">{{ a.correctCount }}/{{ a.total }} · {{ a.score }}%</span></div>
                        } @empty { <p class="hist-empty">No attempts recorded.</p> }
                      }
                    </div>
                  }
                } @empty {
                  <p class="text-sm text-txt-mute py-4 text-center">No quizzes match your search or filter.</p>
                }
              </div>
            }
          </asta-card>

          <!-- attempt history -->
          @if (attempts().length) {
            <asta-card class="motion-card-reveal motion-lower" style="--motion-card-index:1">
              <div class="panel-head mb-3">
                <p class="kicker">Recent attempts</p>
                <span class="panel-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 2"/></svg>
                </span>
              </div>
              <div class="space-y-2">
                @for (a of attempts().slice(0, 8); track a.id) {
                  <div class="row">
                    <div class="min-w-0">
                      <p class="text-sm font-medium truncate">{{ quizTitle(a.quizId) }}</p>
                      <p class="text-[11px] text-txt-mute">{{ relTime(a.createdAt) }} · {{ a.correctCount }}/{{ a.total }} correct@if (a.weakTopics.length) { · weak: {{ a.weakTopics.slice(0, 2).join(', ') }} }</p>
                    </div>
                    <span class="score-pill" [style.color]="scoreColor(a.score)">{{ a.score }}%</span>
                  </div>
                }
              </div>
            </asta-card>
          }
        </div>
        }
      }

      @case ('take') {
        @if (quiz(); as qz) {
          <asta-card class="block motion-card-reveal motion-row-primary" style="--motion-card-index:0;max-width:760px;margin:0 auto">
            <div class="flex items-center justify-between gap-3 mb-1">
              <h2 class="text-[18px] font-display font-semibold min-w-0 truncate">{{ qz.title }}</h2>
              <div class="flex items-center gap-3 shrink-0">
                <span class="timer-chip" [class.danger]="attemptTimed() && remaining() <= 30">
                  {{ attemptTimed() ? '⏳ ' + countdown() : '⏱ ' + clock() }}
                </span>
                <button class="text-xs text-txt-mute hover:text-txt" (click)="cancelTake()">Cancel</button>
              </div>
            </div>
            <p class="text-xs text-txt-mute mb-3">{{ qz.difficulty }} · {{ qz.questions.length }} questions · answer all, then submit</p>

            <!-- progress -->
            <div class="take-progress mb-5" role="progressbar" [attr.aria-valuenow]="answeredCount()" aria-valuemin="0" [attr.aria-valuemax]="qz.questions.length">
              <span class="take-progress-bar" [style.width.%]="qz.questions.length ? (answeredCount() / qz.questions.length) * 100 : 0"></span>
            </div>

            <div class="space-y-6 q-flow motion-row-2">
              @for (item of orderedQuestions(); track item.oi; let pos = $index) {
                <div class="motion-card-reveal" [style.--motion-card-index]="pos">
                  <p class="text-sm font-medium mb-2"><span class="qnum">{{ pos + 1 }}</span> {{ item.q.prompt }}</p>
                  @if (item.q.type === 'mcq') {
                    <div class="space-y-1.5">
                      @for (origOi of optionOrder(item.oi, item.q.options.length); track origOi) {
                        <label class="opt" [class.opt-on]="selectedIndex(item.oi) === origOi">
                          <input type="radio" [name]="'q' + item.oi" [checked]="selectedIndex(item.oi) === origOi" (change)="setChoice(item.oi, origOi)" />
                          <span class="opt-mark" aria-hidden="true"></span>
                          <span>{{ item.q.options[origOi] }}</span>
                        </label>
                      }
                    </div>
                  } @else {
                    <textarea class="input" rows="3" placeholder="Your answer…" (input)="setText(item.oi, $any($event.target).value)"></textarea>
                  }
                  @if (item.q.source) { <p class="text-[11px] text-txt-mute mt-1 font-mono">source: {{ item.q.source }}</p> }
                </div>
              }
            </div>

            <div class="flex items-center gap-3 mt-6">
              <asta-btn variant="accent" astaMagnetic [loading]="submitting()" [disabled]="!allAnswered()" (click)="submit()">Submit quiz <span class="arr">→</span></asta-btn>
              <span class="text-xs text-txt-mute">{{ answeredCount() }}/{{ qz.questions.length }} answered</span>
            </div>
          </asta-card>
        }
      }

      @case ('result') {
        @if (result(); as r) {
          <div class="space-y-5 motion-row-primary" style="max-width:760px;margin:0 auto">
            <asta-card class="block result-hero motion-card-reveal" style="--motion-card-index:0">
              <div class="flex items-start gap-5">
                <asta-ring [value]="r.evaluation.score" [size]="92" />
                <div class="flex-1">
                  <h2 class="text-[18px] font-display font-semibold mb-1"><span [astaCount]="r.evaluation.score" suffix="%"></span> · {{ r.evaluation.correctCount }}/{{ r.evaluation.total }} correct</h2>
                  <p class="text-sm text-txt-soft">{{ r.evaluation.feedback }}</p>
                  <div class="flex gap-2 mt-3">
                    <asta-btn variant="accent" size="sm" astaMagnetic (click)="retake()">Retake</asta-btn>
                    <asta-btn variant="ghost" size="sm" (click)="backHome()">Back to studio</asta-btn>
                  </div>
                </div>
              </div>
            </asta-card>

            @if (weaknessBlock(); as wb) { <ai-visual-block [block_]="wb" /> }

            <asta-card class="block motion-card-reveal" style="--motion-card-index:1">
              <div class="panel-head mb-3">
                <p class="kicker">Review</p>
                <span class="panel-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                </span>
              </div>
              <div class="space-y-4">
                @for (rev of r.review; track $index) {
                  <div class="rev-block" [class.rev-block-ok]="rev.correct" [class.rev-block-no]="!rev.correct">
                    <p class="text-sm font-medium mb-1">
                      <span [style.color]="rev.correct ? 'var(--green-deep)' : 'var(--coral-deep)'">{{ rev.correct ? '✓' : '✗' }}</span>
                      <span class="text-txt-mute font-mono mx-1">{{ $index + 1 }}.</span>{{ rev.prompt }}
                    </p>
                    @if (rev.type === 'mcq') {
                      <div class="space-y-1 ml-5">
                        @for (opt of rev.options; track $index) {
                          <div class="rev-opt"
                            [class.rev-correct]="$index === rev.answerIndex"
                            [class.rev-wrong]="$index === rev.yourAnswerIndex && $index !== rev.answerIndex">
                            {{ opt }}
                            @if ($index === rev.answerIndex) { <span class="tagok">correct</span> }
                            @if ($index === rev.yourAnswerIndex && $index !== rev.answerIndex) { <span class="tagno">your answer</span> }
                          </div>
                        }
                      </div>
                    } @else {
                      <p class="text-[13px] ml-5"><span class="text-txt-mute">Your answer:</span> {{ rev.yourText || '—' }}</p>
                      <p class="text-[13px] ml-5"><span class="text-txt-mute">Model answer:</span> {{ rev.modelAnswer }}</p>
                    }
                    @if (rev.explanation) { <p class="explain ml-5 mt-1">{{ rev.explanation }}</p> }
                  </div>
                }
              </div>
            </asta-card>
          </div>
        }
      }
    }
  `,
  styles: [
    `
      .stat { padding: 14px 16px; }
      .lbl { font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
      .mt-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .mt-chip { font-size: 12px; padding: 3px 10px; border-radius: 999px; color: var(--green-deep); background: color-mix(in oklch, var(--green) 12%, transparent); border: 1px solid color-mix(in oklch, var(--green) 30%, transparent); }
      .qz-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
      .qz-search { flex: 1; min-width: 170px; padding: 8px 12px; font-size: 13px; color: var(--text); background: color-mix(in oklch, var(--paper-2) 60%, transparent); border: 1px solid var(--paper-3); border-radius: 11px; }
      .qz-search:focus { outline: none; border-color: var(--green); }
      .qz-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .hist-btn { font-size: 11px; color: var(--peri, #8aa6ff); background: transparent; border: none; cursor: pointer; padding: 0 4px; }
      .hist-btn:hover { color: var(--green-deep); }
      .hist { margin: 2px 0 8px; padding: 8px 12px; border-radius: 10px; background: color-mix(in oklch, var(--paper-2) 55%, transparent); border: 1px solid var(--paper-3); }
      .hist-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-soft); padding: 2px 0; }
      .hist-score { font-variant-numeric: tabular-nums; font-weight: 600; }
      .hist-empty { font-size: 12px; color: var(--text-mute); }
      .src { text-align: left; border: 1px solid var(--paper-3); border-radius: 12px; padding: 8px 12px; background: var(--paper); font-size: 13px; min-width: 150px; }
      .src-on { border-color: var(--green); background: oklch(0.80 0.16 150 / .06); }
      .chip { font-family: var(--mono); font-size: 11px; text-transform: uppercase; padding: 5px 11px; border-radius: 100px; border: 1px solid color-mix(in oklch, var(--paper-3) 70%, transparent); background: color-mix(in oklch, var(--paper-2) 55%, transparent); color: var(--text-soft); cursor: pointer; transition: transform .15s var(--ease-spring), border-color .15s var(--ease), color .15s var(--ease); }
      .chip:hover { color: var(--text); border-color: color-mix(in oklch, var(--green) 38%, transparent); transform: translateY(-1px); }
      .chip-on { background: linear-gradient(135deg, var(--green), var(--green-deep)); color: #06100a; border-color: transparent; box-shadow: 0 4px 12px var(--asta-accent-glow); }
      .chip-on:hover { color: #06100a; transform: translateY(-1px); }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 14px; }
      .opt { display: flex; gap: 10px; align-items: center; border: 1px solid var(--paper-3); border-radius: 10px; padding: 9px 12px; font-size: 14px; cursor: pointer; }
      .opt-on { border-color: var(--green); background: oklch(0.80 0.16 150 / .06); }
      .rev-opt { font-size: 13px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--paper-3); }
      .rev-correct { border-color: var(--green); background: oklch(0.80 0.16 150 / .12); }
      .rev-wrong { border-color: var(--coral); background: oklch(0.72 0.17 25 / .10); }
      .tagok { font-size: 10px; color: var(--green-deep); margin-left: 6px; }
      .tagno { font-size: 10px; color: var(--coral-deep); margin-left: 6px; }
      .timer-chip { font-family: var(--mono); font-size: 12px; font-variant-numeric: tabular-nums; padding: 4px 10px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); }
      .timer-chip.danger { color: var(--coral-deep); border-color: color-mix(in oklch, var(--coral) 45%, var(--paper-3)); background: oklch(0.72 0.17 25 / .10); }
      .score-pill { font-family: var(--mono); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; padding: 3px 10px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper-2); flex-shrink: 0; }
    `,
  ],
})
export class QuizStudioComponent implements OnInit, OnDestroy {
  private readonly quizApi = inject(QuizService);
  private readonly knowledge = inject(KnowledgeService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly confetti = inject(ConfettiService);

  readonly sources = SOURCES;
  readonly diffs = DIFFS;
  readonly view = signal<View>('home');
  readonly quizzes = signal<QuizSummary[]>([]);
  readonly quizQuery = signal('');
  readonly quizSource = signal<string>('all');
  readonly quizSources = computed(() =>
    [...new Set(this.quizzes().map((q) => q.source))].sort((a, b) => a.localeCompare(b)),
  );
  readonly filteredQuizzes = computed(() => {
    const needle = this.quizQuery().trim().toLowerCase();
    const src = this.quizSource();
    return this.quizzes().filter((q) => {
      if (src !== 'all' && q.source !== src) return false;
      if (needle && !q.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  });
  readonly docs = signal<KnowledgeDoc[]>([]);
  readonly stats = signal<QuizStats | null>(null);
  readonly attempts = signal<AttemptView[]>([]);
  readonly historyFor = signal<string | null>(null);
  readonly historyAttempts = signal<AttemptView[]>([]);
  readonly historyLoading = signal(false);
  readonly quiz = signal<TakeQuiz | null>(null);
  readonly result = signal<SubmitResult | null>(null);
  readonly generating = signal(false);
  readonly submitting = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  // generate form
  readonly source = signal<QuizSource>('topic');
  readonly difficulty = signal<Difficulty | null>(null);
  readonly timed = signal(false);
  /** When on, question order is randomized per attempt (display-only — grading uses original indices). */
  readonly shuffle = signal(false);
  /** Display order of original question indices for the current attempt. */
  private readonly order = signal<number[]>([]);
  /** Per-question display order of ORIGINAL option indices (keyed by original question index). */
  private readonly optionOrders = signal<Map<number, number[]>>(new Map());
  /** The display order of original option indices for a question — stable per attempt. */
  optionOrder(qIdx: number, len: number): number[] {
    return this.optionOrders().get(qIdx) ?? Array.from({ length: len }, (_, i) => i);
  }
  /** Questions paired with their ORIGINAL index, in display order. */
  readonly orderedQuestions = computed(() => {
    const q = this.quiz();
    if (!q) return [] as { q: TakeQuiz['questions'][number]; oi: number }[];
    const ord = this.order();
    const seq = ord.length === q.questions.length ? ord : q.questions.map((_, i) => i);
    return seq.map((oi) => ({ q: q.questions[oi], oi }));
  });
  topic = '';
  documentId = '';
  count = 5;
  limitMin = 10;

  // timer (count-up always; countdown when the attempt is timed)
  readonly elapsed = signal(0);
  readonly remaining = signal(0);
  readonly attemptTimed = signal(false);
  private timer?: ReturnType<typeof setInterval>;
  readonly clock = computed(() => this.fmt(this.elapsed()));
  readonly countdown = computed(() => this.fmt(this.remaining()));

  private answers = signal<Map<number, QuizAnswer>>(new Map());
  private startedAt = 0;

  readonly readyDocs = computed(() => this.docs().filter((d) => d.status === 'ready'));
  readonly canGenerate = computed(() => {
    if (this.generating()) return false;
    if (this.source() === 'topic') return this.topic.trim().length >= 2;
    if (this.source() === 'document') return !!this.documentId;
    return true;
  });

  ngOnInit(): void {
    this.refresh();
    this.knowledge.list().subscribe({ next: (d) => this.docs.set(d) });
    const deepLink = this.route.snapshot.queryParamMap.get('quizId');
    if (deepLink) this.startQuiz(deepLink);
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.quizApi.list().subscribe({
      next: (q) => this.quizzes.set(q),
      error: () => { this.loadError.set(true); done(); },
      complete: done,
    });
    this.quizApi.stats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => { this.loadError.set(true); done(); },
      complete: done,
    });
    // Attempt history — best-effort, never blocks the home view.
    this.quizApi.attempts().subscribe({ next: (a) => this.attempts.set(a), error: () => undefined });
  }

  /** Quiz title for an attempt row (the attempt only carries a quizId). */
  quizTitle(quizId: string): string {
    return this.quizzes().find((q) => q.id === quizId)?.title ?? 'Quiz';
  }

  scoreColor(s: number): string {
    return s >= 70 ? 'var(--green-deep)' : s >= 40 ? 'var(--peri-deep)' : 'var(--coral-deep)';
  }

  relTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const day = Math.floor(ms / 86_400_000);
    if (day <= 0) {
      const h = Math.floor(ms / 3_600_000);
      if (h >= 1) return `${h}h ago`;
      const mi = Math.floor(ms / 60_000);
      return mi >= 1 ? `${mi}m ago` : 'just now';
    }
    if (day === 1) return 'yesterday';
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  toggleHistory(quizId: string): void {
    if (this.historyFor() === quizId) { this.historyFor.set(null); return; }
    this.historyFor.set(quizId);
    this.historyLoading.set(true);
    this.historyAttempts.set([]);
    this.quizApi.attemptsForQuiz(quizId).subscribe({
      next: (a) => { this.historyAttempts.set(a); this.historyLoading.set(false); },
      error: () => { this.historyLoading.set(false); },
    });
  }

  private fmt(s: number): string {
    const safe = Math.max(0, s);
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  }

  private startTimer(): void {
    this.stopTimer();
    this.elapsed.set(0);
    const isTimed = this.timed();
    this.attemptTimed.set(isTimed);
    this.remaining.set(isTimed ? Math.max(1, Math.round(this.limitMin)) * 60 : 0);
    this.timer = setInterval(() => {
      this.elapsed.update((s) => s + 1);
      if (this.attemptTimed()) {
        const r = this.remaining() - 1;
        this.remaining.set(r);
        if (r <= 0) {
          this.stopTimer();
          this.autoSubmit();
        }
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private autoSubmit(): void {
    if (this.submitting() || this.view() !== 'take') return;
    this.toast.info('Time’s up — submitting your answers');
    this.submit();
  }

  /** Smoothly scroll the generator panel into view from the empty-library CTA. */
  scrollToGenerate(): void {
    document.querySelector('[data-asta-scroll]')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  generate(): void {
    this.generating.set(true);
    this.quizApi
      .generate({
        source: this.source(),
        topic: this.topic.trim() || undefined,
        documentId: this.documentId || undefined,
        difficulty: this.difficulty() ?? undefined,
        count: this.count,
      })
      .subscribe({
        next: (quiz) => {
          this.generating.set(false);
          this.openTake(quiz);
          this.refresh();
        },
        error: (e) => {
          this.generating.set(false);
          this.toast.error(e?.message ?? 'Could not generate quiz');
        },
      });
  }

  startQuiz(id: string): void {
    this.quizApi.take(id).subscribe({
      next: (quiz) => this.openTake(quiz),
      error: () => this.toast.error('Could not load quiz'),
    });
  }

  private openTake(quiz: TakeQuiz): void {
    this.quiz.set(quiz);
    this.order.set(this.buildOrder(quiz.questions.length));
    // Per-question option order — shuffled with the same toggle, identity otherwise. Built once per attempt.
    const opts = new Map<number, number[]>();
    quiz.questions.forEach((q, i) => opts.set(i, this.buildOrder(q.options?.length ?? 0)));
    this.optionOrders.set(opts);
    this.answers.set(new Map());
    this.result.set(null);
    this.startedAt = Date.now();
    this.view.set('take');
    this.startTimer();
  }

  /** Sequential by default; Fisher–Yates shuffle when the Shuffle toggle is on. */
  private buildOrder(n: number): number[] {
    const arr = Array.from({ length: n }, (_, i) => i);
    if (!this.shuffle()) return arr;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  cancelTake(): void {
    this.stopTimer();
    this.view.set('home');
  }

  setChoice(questionIndex: number, answerIndex: number): void {
    this.answers.update((m) => {
      const next = new Map(m);
      next.set(questionIndex, { questionIndex, answerIndex });
      return next;
    });
  }
  setText(questionIndex: number, text: string): void {
    this.answers.update((m) => {
      const next = new Map(m);
      next.set(questionIndex, { questionIndex, text });
      return next;
    });
  }
  answerFor(i: number): QuizAnswer | undefined {
    return this.answers().get(i);
  }
  selectedIndex(i: number): number | undefined {
    return this.answers().get(i)?.answerIndex;
  }
  answeredCount(): number {
    return [...this.answers().values()].filter((a) => a.answerIndex !== undefined || (a.text ?? '').trim()).length;
  }
  allAnswered(): boolean {
    const q = this.quiz();
    return !!q && this.answeredCount() >= q.questions.length;
  }

  submit(): void {
    const quiz = this.quiz();
    if (!quiz) return;
    this.stopTimer();
    this.submitting.set(true);
    const answers = quiz.questions.map((_, i) => this.answers().get(i) ?? { questionIndex: i });
    this.quizApi.submit(quiz.id, answers, Date.now() - this.startedAt).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.result.set(res);
        this.view.set('result');
        this.refresh();
        // Celebrate a passing score (D2 · reduced-motion-safe).
        if (res.evaluation.score >= 70) this.confetti.burst({ y: 0.35 });
      },
      error: (e) => {
        this.submitting.set(false);
        this.toast.error(e?.message ?? 'Could not submit');
      },
    });
  }

  weaknessBlock(): WeaknessAnalysisBlock | null {
    const r = this.result();
    if (!r) return null;
    const weak = r.evaluation.topicScores.filter((t) => t.severity > 0);
    if (weak.length === 0) return null;
    return {
      type: 'weakness_analysis',
      title: 'Where to focus next',
      weaknesses: weak.map((t) => ({
        topic: t.topic,
        severity: t.severity,
        note: `${t.correct}/${t.total} correct`,
      })),
    } as WeaknessAnalysisBlock & VisualBlock;
  }

  retake(): void {
    const quiz = this.quiz();
    if (quiz) this.openTake(quiz);
  }
  backHome(): void {
    this.stopTimer();
    this.view.set('home');
    this.quiz.set(null);
    this.result.set(null);
  }
}
