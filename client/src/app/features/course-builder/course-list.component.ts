import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { Course, CourseService, Difficulty } from '../../core/services/course.service';

@Component({
  selector: 'asta-course-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Course Builder</h1>
        <span class="goal-pill"><span class="dot"></span>Turn a goal into a full course — modules, quizzes, project, certificate</span>
      </div>
      <div class="flex gap-2.5 shrink-0"><asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn></div>
    </header>

    <asta-card class="block motion-card-reveal motion-row-primary mb-5">
      <p class="kicker mb-3">Generate a course</p>
      <div class="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Goal / subject</span>
          <input class="cb-input mt-1" [(ngModel)]="goal" (keydown.enter)="generate()" placeholder="e.g. Teach the MERN stack to beginners" maxlength="160" aria-label="Course goal" />
        </label>
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Level</span>
          <select class="cb-input mt-1" [(ngModel)]="level" aria-label="Level">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <asta-btn variant="accent" [loading]="creating()" [disabled]="goal.trim().length < 2" (click)="generate()">Generate <span class="arr">→</span></asta-btn>
      </div>
    </asta-card>

    @if (loading()) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">@for (i of [1,2,3]; track i) { <asta-card><asta-skeleton h="90px" /></asta-card> }</div>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load courses" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (courses().length === 0) {
      <asta-card class="block motion-card-reveal"><asta-empty-state title="No courses yet" description="Type a goal above — Asta drafts modules, lessons, a project and certificate criteria you can edit, then generate quizzes/visuals per module and publish."><asta-btn variant="accent" (click)="focusGoal()">Build your first course</asta-btn></asta-empty-state></asta-card>
    } @else {
      <div class="grid gap-3 grid-cols-3 mb-5">
        <asta-card class="cb-stat"><p class="num">{{ publishedCount() }}</p><p class="lbl">Published</p></asta-card>
        <asta-card class="cb-stat"><p class="num">{{ draftCount() }}</p><p class="lbl">Drafts</p></asta-card>
        <asta-card class="cb-stat"><p class="num">{{ moduleCount() }}</p><p class="lbl">Total modules</p></asta-card>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 motion-row-2">
        @for (c of courses(); track c.id; let i = $index) {
          <asta-card class="motion-card-reveal hover-lift cursor-pointer block" [interactive]="true" [style.--motion-card-index]="i % 3" (click)="open(c)">
            <div class="flex items-start justify-between gap-2">
              <p class="font-display text-lg leading-snug truncate">{{ c.title }}</p>
              <span class="status st-{{ c.status }}">{{ c.status }}</span>
            </div>
            <p class="text-sm text-txt-mute mt-0.5 line-clamp-2">{{ c.description }}</p>
            <div class="flex flex-wrap gap-1.5 mt-3 text-[11px] text-txt-mute">
              <span class="pill">{{ c.modules.length }} modules</span>
              <span class="pill">{{ c.level }}</span>
              @if (c.status === 'published') { <span class="pill">{{ c.visibility }}</span> }
            </div>
          </asta-card>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .cb-input { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 12px; color: var(--text); font-size: 14px; }
      .cb-input:focus { outline: none; border-color: var(--green); }
      .pill { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--paper-3); background: color-mix(in oklab, var(--paper-2) 70%, transparent); }
      .status { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--paper-3); white-space: nowrap; }
      .st-published { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); }
      .st-draft { color: var(--text-mute); }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .cb-stat { text-align: center; }
      .cb-stat .num { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--green-deep); }
      .cb-stat .lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
    `,
  ],
})
export class CourseListComponent {
  private readonly api = inject(CourseService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly courses = signal<Course[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly creating = signal(false);
  goal = '';
  level: Difficulty = 'beginner';

  readonly publishedCount = computed(() => this.courses().filter((c) => c.status === 'published').length);
  readonly draftCount = computed(() => this.courses().filter((c) => c.status !== 'published').length);
  readonly moduleCount = computed(() => this.courses().reduce((n, c) => n + (c.modules?.length ?? 0), 0));

  constructor() { this.refresh(); }
  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.list().subscribe({ next: (l) => { this.courses.set(l); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  focusGoal(): void { document.querySelector<HTMLInputElement>('.cb-input')?.focus(); }
  generate(): void {
    if (this.goal.trim().length < 2) return;
    this.creating.set(true);
    this.api.generate({ goal: this.goal.trim(), level: this.level }).subscribe({
      next: (c) => { this.creating.set(false); this.router.navigate(['/app/course-builder', c.id]); },
      error: (e: Error) => { this.creating.set(false); this.toast.error(e.message || 'Could not generate course'); },
    });
  }
  open(c: Course): void { this.router.navigate(['/app/course-builder', c.id]); }
}
