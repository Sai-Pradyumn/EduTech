import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { RichContentComponent } from '../../shared/components/ai/rich-content.component';
import { ToastService } from '../../core/services/toast.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { Course, CourseLesson, CourseModule, CourseService, CourseVisibility } from '../../core/services/course.service';

/** One row in the flattened lesson navigation. */
interface LessonRef { module: CourseModule; lesson: CourseLesson; }

@Component({
    selector: 'asta-course-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent, RichContentComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ course()?.title || 'Course' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ course() ? course()!.modules.length + ' modules · ' + doneCount() + '/' + totalLessons() + ' lessons done' : 'Loading…' }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0 flex-wrap">
        <asta-btn variant="ghost" size="sm" (click)="back()">All courses</asta-btn>
        @if (course()) {
          <div class="seg-row" role="tablist" aria-label="Course view">
            <button class="seg" role="tab" [class.on]="view() === 'learn'" [attr.aria-selected]="view() === 'learn'" (click)="view.set('learn')">Learn</button>
            <button class="seg" role="tab" [class.on]="view() === 'design'" [attr.aria-selected]="view() === 'design'" (click)="view.set('design')">Design</button>
          </div>
        }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="360px" /></asta-card>
    } @else if (loadError() || !course()) {
      <asta-card><asta-empty-state title="Could not load this course" description=""><asta-btn variant="accent" (click)="reload()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (view() === 'learn') {
      <!-- ─────────────── LEARN MODE — actually take the course ─────────────── -->
      <div class="prog-track mb-4" role="progressbar" [attr.aria-valuenow]="progressPct()" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'Course progress: ' + progressPct() + '%'">
        <span class="prog-fill" [style.width.%]="progressPct()"></span>
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <!-- reader -->
        <asta-card class="block motion-card-reveal min-w-0">
          @if (active(); as a) {
            <p class="kicker mb-1">{{ a.module.title }}</p>
            <div class="flex items-start justify-between gap-3 flex-wrap mb-1">
              <h2 class="t-h-card !mb-0">{{ a.lesson.title }}</h2>
              <span class="text-[11px] text-txt-mute whitespace-nowrap mt-1.5">~{{ a.lesson.estimateMinutes }} min</span>
            </div>
            @if (expanding()) {
              <div class="mt-3 space-y-2.5" aria-label="Writing this lesson for you">
                <p class="text-[12px] text-txt-mute">Asta is writing this lesson for you…</p>
                <asta-skeleton h="14px" w="92%" /><asta-skeleton h="14px" w="85%" /><asta-skeleton h="14px" w="70%" />
                <asta-skeleton h="14px" w="88%" /><asta-skeleton h="14px" w="60%" />
              </div>
            } @else {
              <asta-rich-content class="block mt-3 text-[15px]" [text]="a.lesson.body || a.lesson.content" />
              <div class="flex items-center justify-between gap-3 flex-wrap mt-5 pt-4" style="border-top:1px solid var(--paper-3)">
                <div class="flex gap-2">
                  <asta-btn variant="ghost" size="sm" [disabled]="!prevLesson()" (click)="openRef(prevLesson())">← Previous</asta-btn>
                  <asta-btn variant="ghost" size="sm" [disabled]="!nextLesson()" (click)="openRef(nextLesson())">Next →</asta-btn>
                </div>
                <div class="flex gap-2 items-center">
                  <button class="rewrite" [disabled]="busy() === 'rewrite'" (click)="rewrite(a.lesson)" title="Rewrite this lesson">{{ busy() === 'rewrite' ? 'Rewriting…' : '↻ Rewrite' }}</button>
                  <asta-btn [variant]="isDone(a.lesson.id) ? 'ghost' : 'accent'" size="sm" (click)="toggleDone(a.lesson)">
                    {{ isDone(a.lesson.id) ? '✓ Completed — undo' : 'Mark lesson complete' }}
                  </asta-btn>
                </div>
              </div>
            }
          } @else {
            <asta-empty-state title="No lessons in this course yet" description="Switch to Design to add modules and lessons." />
          }
        </asta-card>

        <!-- lesson navigation -->
        <div class="space-y-3">
          @for (m of course()!.modules; track m.id) {
            <asta-card class="block" pad="12px 14px">
              <p class="text-[12px] font-semibold mb-1.5 truncate" [title]="m.title">{{ m.title }}</p>
              <div class="space-y-0.5">
                @for (l of m.lessons; track l.id) {
                  <button class="nav-l" [class.on]="activeLessonId() === l.id" (click)="open(l.id)">
                    <span class="nav-check" [class.done]="isDone(l.id)">{{ isDone(l.id) ? '✓' : '' }}</span>
                    <span class="truncate flex-1 text-left">{{ l.title }}</span>
                    <span class="text-[10px] text-txt-mute">{{ l.estimateMinutes }}m</span>
                  </button>
                }
              </div>
              <div class="mt-2">
                @if (m.linkedQuizId) {
                  <button class="quiz-chip" (click)="takeQuiz(m)">Take module quiz →</button>
                } @else {
                  <button class="quiz-chip" [disabled]="busy() === 'quiz_' + m.id" (click)="genQuiz(m)">{{ busy() === 'quiz_' + m.id ? 'Generating…' : '+ Generate module quiz' }}</button>
                }
              </div>
            </asta-card>
          }
          <asta-card class="block" pad="12px 14px">
            <p class="kicker mb-1">Capstone project</p>
            <p class="text-[13px] font-medium">{{ course()!.project.title }}</p>
            <p class="text-[12px] text-txt-soft">{{ course()!.project.brief }}</p>
            @if (course()!.project.linkedProjectId) { <p class="text-[11px] text-green-deep mt-1">✓ Project generated</p> }
          </asta-card>
        </div>
      </div>
    } @else {
      <!-- ─────────────── DESIGN MODE — edit the course ─────────────── -->
      <div class="flex gap-2.5 mb-4 flex-wrap">
        <asta-btn variant="ghost" size="sm" [loading]="busy()==='flow'" (click)="genFlow()">Generate flow</asta-btn>
        <asta-btn variant="ghost" size="sm" [loading]="busy()==='project'" (click)="genProject()">Generate project</asta-btn>
      </div>
      <div class="grid gap-4 lg:grid-cols-[1fr_280px] items-start">
        <div class="min-w-0 space-y-3">
          @for (m of course()!.modules; track m.id; let i = $index) {
            <asta-card class="block motion-card-reveal" [style.--motion-card-index]="i % 4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <input class="m-title" [(ngModel)]="m.title" (blur)="dirty.set(true)" aria-label="Module title" />
                  <p class="text-xs text-txt-mute mt-0.5">{{ m.summary }}</p>
                </div>
                <div class="flex gap-1.5 shrink-0">
                  @if (m.linkedQuizId) { <span class="link">✓ quiz</span> }
                  @if (m.linkedVisualId) { <span class="link">◈ visual</span> }
                </div>
              </div>
              <div class="lessons mt-2">
                @for (l of m.lessons; track l.id) {
                  <div class="lesson-wrap">
                    <div class="lesson">
                      <input class="l-title" [(ngModel)]="l.title" (blur)="dirty.set(true)" aria-label="Lesson title" />
                      <span class="l-min">{{ l.estimateMinutes }}m</span>
                    </div>
                    @if (l.content) { <p class="l-content">{{ l.content }}</p> }
                  </div>
                }
              </div>
              @if (m.voiceScript) {
                <details class="vs mt-2"><summary>Narration script</summary><p>{{ m.voiceScript }}</p></details>
              }
              <div class="flex gap-2 mt-2">
                <asta-btn variant="ghost" size="sm" [loading]="busy()==='quiz_'+m.id" (click)="genQuiz(m)">Generate quiz</asta-btn>
                <asta-btn variant="ghost" size="sm" [loading]="busy()==='visual_'+m.id" (click)="genVisual(m)">Generate visual</asta-btn>
              </div>
            </asta-card>
          }
          @if (dirty()) {
            <asta-btn variant="accent" size="sm" [loading]="saving()" (click)="save()">Save edits</asta-btn>
          }
        </div>

        <div class="space-y-4">
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-2">Publish</p>
            <p class="text-sm text-txt-soft mb-2">Current: <b>{{ course()!.status }}</b> · {{ course()!.visibility }}</p>
            <div class="grid gap-2">
              <asta-btn variant="ghost" size="sm" (click)="publish('private')">Publish (private)</asta-btn>
              <asta-btn variant="accent" size="sm" (click)="publish('org')">Publish to organization</asta-btn>
            </div>
            <p class="text-[11px] text-txt-mute mt-2">Org/cohort publishing needs a mentor or admin account.</p>
          </asta-card>

          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-1">Capstone project</p>
            <p class="text-sm font-medium">{{ course()!.project.title }}</p>
            <p class="text-sm text-txt-soft">{{ course()!.project.brief }}</p>
            @if (course()!.project.linkedProjectId) { <p class="text-[11px] text-green-deep mt-1">✓ Project generated</p> }
          </asta-card>

          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-1">Certificate criteria</p>
            <ul class="text-sm text-txt-soft space-y-0.5">@for (c of course()!.certificateCriteria; track c) { <li>• {{ c }}</li> }</ul>
            @if (course()!.linkedFlowId) { <p class="text-[11px] text-green-deep mt-2">✓ Linked flow created</p> }
          </asta-card>
        </div>
      </div>
    }
  `,
    styles: [
        `
      :host { display: block; }
      .seg-row { display: inline-flex; gap: 2px; background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 999px; padding: 3px; }
      .seg { font-size: 12px; padding: 5px 14px; border-radius: 999px; border: none; background: transparent; color: var(--text-soft); cursor: pointer; }
      .seg.on { background: color-mix(in oklab, var(--green) 22%, transparent); color: var(--text); font-weight: 600; }
      .prog-track { height: 6px; border-radius: 999px; background: var(--paper-3); overflow: hidden; }
      .prog-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--green-deep), var(--green)); transition: width .4s var(--ease); }
      .nav-l { display: flex; align-items: center; gap: 8px; width: 100%; font-size: 12.5px; padding: 6px 8px; border-radius: 8px; color: var(--text-soft); cursor: pointer; border: none; background: transparent; transition: background .14s var(--ease), color .14s var(--ease); }
      .nav-l:hover { background: var(--paper-2); color: var(--text); }
      .nav-l.on { background: color-mix(in oklab, var(--green) 12%, transparent); color: var(--text); font-weight: 600; }
      .nav-check { width: 16px; height: 16px; flex-shrink: 0; display: grid; place-items: center; border-radius: 5px; border: 1.5px solid var(--paper-3); font-size: 10px; color: var(--green-deep); }
      .nav-check.done { background: color-mix(in oklab, var(--green) 18%, transparent); border-color: var(--green); }
      .quiz-chip { font-size: 11.5px; font-weight: 600; padding: 5px 11px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 35%, var(--paper-3)); background: color-mix(in oklab, var(--peri, #8aa6ff) 10%, transparent); color: var(--peri-deep, #6f86e0); cursor: pointer; }
      .quiz-chip:disabled { opacity: .6; cursor: default; }
      .rewrite { font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--paper-3); background: transparent; color: var(--text-mute); cursor: pointer; transition: color .14s var(--ease), border-color .14s var(--ease); }
      .rewrite:hover:not(:disabled) { color: var(--text); border-color: color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
      .rewrite:disabled { opacity: .6; cursor: default; }
      .m-title { width: 100%; background: transparent; border: none; color: var(--text); font-size: 16px; font-weight: 600; font-family: inherit; }
      .m-title:focus { outline: none; border-bottom: 1px solid var(--green); }
      .lesson { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
      .l-title { flex: 1; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 8px; padding: 6px 9px; color: var(--text-soft); font-size: 13px; font-family: inherit; }
      .l-title:focus { outline: none; border-color: var(--green); }
      .l-min { font-size: 11px; color: var(--text-mute); white-space: nowrap; }
      .l-content { font-size: 12px; color: var(--text-mute); line-height: 1.5; margin: 2px 0 6px 2px; }
      .vs { font-size: 12px; color: var(--text-soft); }
      .vs summary { cursor: pointer; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); }
      .vs p { margin-top: 6px; line-height: 1.55; white-space: pre-wrap; }
      .link { font-size: 10px; padding: 2px 7px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); }
    `,
    ]
})
export class CourseDetailComponent {
  private readonly api = inject(CourseService);
  private readonly toast = inject(ToastService);
  private readonly confetti = inject(ConfettiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly course = signal<Course | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal<string | null>(null);
  readonly saving = signal(false);
  readonly dirty = signal(false);

  // ── Learn mode state ──
  readonly view = signal<'learn' | 'design'>('learn');
  readonly activeLessonId = signal<string | null>(null);
  readonly expanding = signal(false);

  /** All lessons in course order, with their module. */
  readonly flat = computed<LessonRef[]>(() => {
    const c = this.course();
    if (!c) return [];
    return c.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
  });
  readonly totalLessons = computed(() => this.flat().length);
  readonly doneCount = computed(() => {
    const done = new Set(this.course()?.completedLessons ?? []);
    return this.flat().filter((r) => done.has(r.lesson.id)).length;
  });
  readonly progressPct = computed(() => {
    const total = this.totalLessons();
    return total ? Math.round((this.doneCount() / total) * 100) : 0;
  });
  readonly active = computed<LessonRef | null>(() => {
    const id = this.activeLessonId();
    return this.flat().find((r) => r.lesson.id === id) ?? null;
  });
  readonly prevLesson = computed<LessonRef | null>(() => {
    const i = this.flat().findIndex((r) => r.lesson.id === this.activeLessonId());
    return i > 0 ? this.flat()[i - 1] : null;
  });
  readonly nextLesson = computed<LessonRef | null>(() => {
    const list = this.flat();
    const i = list.findIndex((r) => r.lesson.id === this.activeLessonId());
    return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  });

  constructor() { this.reload(); }
  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loadError.set(true); this.loading.set(false); return; }
    this.loading.set(true); this.loadError.set(false);
    this.api.get(id).subscribe({
      next: (c) => {
        this.course.set(c);
        this.loading.set(false);
        this.continueWhereLeftOff(c);
      },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }
  private id(): string { return this.course()!.id; }

  /** Pick up at the last opened lesson, else the first incomplete, else the first. */
  private continueWhereLeftOff(c: Course): void {
    const refs = c.modules.flatMap((m) => m.lessons);
    if (!refs.length) return;
    const done = new Set(c.completedLessons ?? []);
    const target =
      (c.lastLessonId && refs.find((l) => l.id === c.lastLessonId && !done.has(l.id))) ||
      refs.find((l) => !done.has(l.id)) ||
      refs[0];
    this.open(target.id);
  }

  isDone(lessonId: string): boolean {
    return (this.course()?.completedLessons ?? []).includes(lessonId);
  }

  /** Open a lesson: the body is written on FIRST open, then served from cache. */
  open(lessonId: string): void {
    this.activeLessonId.set(lessonId);
    const ref = this.flat().find((r) => r.lesson.id === lessonId);
    const hasBody = !!ref?.lesson.body;
    if (!hasBody) this.expanding.set(true);
    this.api.expandLesson(this.id(), lessonId).subscribe({
      next: (c) => { this.course.set(c); this.expanding.set(false); },
      error: () => {
        this.expanding.set(false);
        if (!hasBody) this.toast.error('Could not load this lesson');
      },
    });
  }
  openRef(ref: LessonRef | null): void { if (ref) this.open(ref.lesson.id); }

  toggleDone(lesson: CourseLesson): void {
    const next = !this.isDone(lesson.id);
    this.api.setLessonProgress(this.id(), lesson.id, next).subscribe({
      next: (c) => {
        this.course.set(c);
        if (next) {
          const after = this.nextLesson();
          if (this.doneCount() >= this.totalLessons() && this.totalLessons() > 0) {
            this.confetti.burst({ y: 0.3, count: 160 });
            this.toast.success('Course complete! 🎉');
          } else if (after) {
            this.open(after.lesson.id); // auto-advance to the next lesson
          }
        }
      },
      error: () => this.toast.error('Could not update progress'),
    });
  }

  rewrite(lesson: CourseLesson): void {
    this.busy.set('rewrite');
    this.api.regenerateLesson(this.id(), lesson.id).subscribe({
      next: (c) => { this.course.set(c); this.busy.set(null); this.toast.success('Lesson rewritten'); },
      error: () => { this.busy.set(null); this.toast.error('Could not rewrite the lesson'); },
    });
  }

  takeQuiz(m: CourseModule): void {
    if (m.linkedQuizId) void this.router.navigate(['/app/quizzes'], { queryParams: { quizId: m.linkedQuizId } });
  }

  save(): void {
    const c = this.course(); if (!c) return;
    this.saving.set(true);
    this.api.update(this.id(), {
      modules: c.modules.map((m) => ({ id: m.id, title: m.title, summary: m.summary, lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, content: l.content })) })),
    }).subscribe({ next: (u) => { this.course.set(u); this.saving.set(false); this.dirty.set(false); this.toast.success('Course saved'); }, error: () => { this.saving.set(false); this.toast.error('Could not save'); } });
  }

  genQuiz(m: CourseModule): void { this.run('quiz_' + m.id, this.api.generateQuiz(this.id(), m.id), 'Quiz generated'); }
  genVisual(m: CourseModule): void { this.run('visual_' + m.id, this.api.generateVisual(this.id(), m.id), 'Visual generated'); }
  genProject(): void { this.run('project', this.api.generateProject(this.id()), 'Project generated'); }
  genFlow(): void {
    this.busy.set('flow');
    this.api.generateFlow(this.id()).subscribe({ next: (r) => { this.course.set(r.course); this.busy.set(null); this.toast.success('Flow created'); this.router.navigate(['/app/flows', r.flowId]); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Failed'); } });
  }
  publish(v: CourseVisibility): void {
    this.api.publish(this.id(), v).subscribe({ next: (c) => { this.course.set(c); this.toast.success(`Published (${v})`); }, error: (e: Error) => this.toast.error(e.message || 'Could not publish') });
  }

  private run(key: string, obs: import('rxjs').Observable<Course>, msg: string): void {
    this.busy.set(key);
    obs.subscribe({ next: (c) => { this.course.set(c); this.busy.set(null); this.toast.success(msg); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Failed'); } });
  }
  back(): void { this.router.navigate(['/app/course-builder']); }
}
