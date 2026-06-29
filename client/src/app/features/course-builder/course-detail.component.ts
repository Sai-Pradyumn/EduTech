import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { Course, CourseModule, CourseService, CourseVisibility } from '../../core/services/course.service';

@Component({
    selector: 'asta-course-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ course()?.title || 'Course' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ course() ? course()!.modules.length + ' modules · ' + course()!.status : 'Loading…' }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0 flex-wrap">
        <asta-btn variant="ghost" size="sm" (click)="back()">All courses</asta-btn>
        @if (course()) {
          <asta-btn variant="ghost" size="sm" [loading]="busy()==='flow'" (click)="genFlow()">Generate flow</asta-btn>
          <asta-btn variant="ghost" size="sm" [loading]="busy()==='project'" (click)="genProject()">Generate project</asta-btn>
        }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="360px" /></asta-card>
    } @else if (loadError() || !course()) {
      <asta-card><asta-empty-state title="Could not load this course" description=""><asta-btn variant="accent" (click)="reload()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else {
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly course = signal<Course | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal<string | null>(null);
  readonly saving = signal(false);
  readonly dirty = signal(false);

  constructor() { this.reload(); }
  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loadError.set(true); this.loading.set(false); return; }
    this.loading.set(true); this.loadError.set(false);
    this.api.get(id).subscribe({ next: (c) => { this.course.set(c); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  private id(): string { return this.course()!.id; }

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
