import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { KnowledgeService } from '../../core/services/knowledge.service';
import { QuizService } from '../../core/services/quiz.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfettiService } from '../../core/services/confetti.service';
import {
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
import { VisualBlockRendererComponent } from '../../shared/components/ai/visual-block-renderer.component';
import { TiltDirective } from '../../shared/directives/tilt.directive';
import { RevealDirective } from '../../shared/directives/reveal.directive';
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
    FormsModule, ButtonComponent, RingComponent, CardComponent, VisualBlockRendererComponent,
    TiltDirective, RevealDirective, MagneticDirective, CountDirective,
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
        <div class="space-y-5">
          <!-- stats -->
          @if (stats(); as s) {
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3" [astaReveal]="0">
              <asta-card astaTilt [tiltMax]="4" class="stat-card">
                <p class="font-display text-2xl"><span [astaCount]="s.quizzes"></span></p><p class="lbl">Quizzes</p>
              </asta-card>
              <asta-card astaTilt [tiltMax]="4" class="stat-card">
                <p class="font-display text-2xl"><span [astaCount]="s.attempts"></span></p><p class="lbl">Attempts</p>
              </asta-card>
              <asta-card astaTilt [tiltMax]="4" class="stat-card">
                <p class="font-display text-2xl"><span [astaCount]="s.averageScore" suffix="%"></span></p><p class="lbl">Avg score</p>
              </asta-card>
              <asta-card astaTilt [tiltMax]="4" class="stat-card">
                <p class="font-display text-2xl"><span [astaCount]="s.weakTopics.length"></span></p><p class="lbl">Weak topics</p>
              </asta-card>
            </div>
          }

          <!-- generate -->
          <asta-card astaTilt [tiltMax]="3" [astaReveal]="1">
            <div class="panel-head mb-3">
              <p class="kicker">Generate a quiz</p>
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg>
              </span>
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
              @for (src of sources; track src.key) {
                <button class="src" [class.src-on]="source() === src.key" (click)="source.set(src.key)">
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
                  <button class="chip" [class.chip-on]="difficulty() === d" (click)="difficulty.set(d)">{{ d }}</button>
                }
                <button class="chip" [class.chip-on]="difficulty() === null" (click)="difficulty.set(null)">adaptive</button>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="text-txt-mute">Questions</span>
                <input type="number" class="input" style="width:70px" min="3" max="15" [(ngModel)]="count" />
              </div>
              <asta-btn variant="accent" size="sm" astaMagnetic [loading]="generating()" [disabled]="!canGenerate()" (click)="generate()">Generate quiz <span class="arr">→</span></asta-btn>
            </div>
          </asta-card>

          <!-- library -->
          <asta-card astaTilt [tiltMax]="3" [astaReveal]="2">
            <div class="panel-head mb-3">
              <p class="kicker">Your quizzes</p>
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </span>
            </div>
            @if (quizzes().length === 0) {
              <p class="text-sm text-txt-mute py-6 text-center">No quizzes yet — generate one above.</p>
            }
            <div class="space-y-2">
              @for (q of quizzes(); track q.id) {
                <div class="row">
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">{{ q.title }}</p>
                    <p class="text-[11px] text-txt-mute">{{ q.difficulty }} · {{ q.questionCount }} Q · {{ q.source }}@if (q.attemptCount) { · best {{ q.bestScore }}% }</p>
                  </div>
                  <asta-btn variant="ghost" size="sm" (click)="startQuiz(q.id)">{{ q.attemptCount ? 'Retake' : 'Take' }} <span class="arr">→</span></asta-btn>
                </div>
              }
            </div>
          </asta-card>
        </div>
      }

      @case ('take') {
        @if (quiz(); as qz) {
          <asta-card class="block" [astaReveal]="0" style="max-width:760px;margin:0 auto">
            <div class="flex items-center justify-between mb-1">
              <h2 class="text-[18px] font-display font-semibold">{{ qz.title }}</h2>
              <button class="text-xs text-txt-mute hover:text-txt" (click)="view.set('home')">Cancel</button>
            </div>
            <p class="text-xs text-txt-mute mb-5">{{ qz.difficulty }} · {{ qz.questions.length }} questions · answer all, then submit</p>

            <div class="space-y-6">
              @for (q of qz.questions; track qi; let qi = $index) {
                <div [astaReveal]="qi">
                  <p class="text-sm font-medium mb-2"><span class="qnum">{{ qi + 1 }}</span> {{ q.prompt }}</p>
                  @if (q.type === 'mcq') {
                    <div class="space-y-1.5">
                      @for (opt of q.options; track oi; let oi = $index) {
                        <label class="opt" [class.opt-on]="selectedIndex(qi) === oi">
                          <input type="radio" [name]="'q' + qi" [value]="oi" [checked]="selectedIndex(qi) === oi" (change)="setChoice(qi, oi)" />
                          <span class="opt-mark" aria-hidden="true"></span>
                          <span>{{ opt }}</span>
                        </label>
                      }
                    </div>
                  } @else {
                    <textarea class="input" rows="3" placeholder="Your answer…" (input)="setText(qi, $any($event.target).value)"></textarea>
                  }
                  @if (q.source) { <p class="text-[11px] text-txt-mute mt-1 font-mono">source: {{ q.source }}</p> }
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
          <div class="space-y-5" style="max-width:760px;margin:0 auto">
            <asta-card class="block result-hero" [astaReveal]="0">
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

            <asta-card class="block" [astaReveal]="1">
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
    `,
  ],
})
export class QuizStudioComponent implements OnInit {
  private readonly quizApi = inject(QuizService);
  private readonly knowledge = inject(KnowledgeService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly confetti = inject(ConfettiService);

  readonly sources = SOURCES;
  readonly diffs = DIFFS;
  readonly view = signal<View>('home');
  readonly quizzes = signal<QuizSummary[]>([]);
  readonly docs = signal<KnowledgeDoc[]>([]);
  readonly stats = signal<QuizStats | null>(null);
  readonly quiz = signal<TakeQuiz | null>(null);
  readonly result = signal<SubmitResult | null>(null);
  readonly generating = signal(false);
  readonly submitting = signal(false);

  // generate form
  readonly source = signal<QuizSource>('topic');
  readonly difficulty = signal<Difficulty | null>(null);
  topic = '';
  documentId = '';
  count = 5;

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

  refresh(): void {
    this.quizApi.list().subscribe({ next: (q) => this.quizzes.set(q) });
    this.quizApi.stats().subscribe({ next: (s) => this.stats.set(s) });
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
    this.answers.set(new Map());
    this.result.set(null);
    this.startedAt = Date.now();
    this.view.set('take');
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
    this.view.set('home');
    this.quiz.set(null);
    this.result.set(null);
  }
}
