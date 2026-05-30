import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { AiProjectReview, Difficulty, Project, ProjectTask, TaskStatus } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { RingComponent } from '../../shared/ui/ring.component';

type View = 'home' | 'board';
const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];
const DIFFS: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

@Component({
  selector: 'asta-project-studio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, RingComponent],
  template: `
    @switch (view()) {
      @case ('home') {
        <div class="space-y-5">
          <div class="card" style="padding:18px">
            <p class="kicker mb-3">Plan a new project</p>
            <p class="text-sm text-txt-soft mb-3">Describe what you want to build — Asta designs a full blueprint: tech stack, features, a phased Kanban board and milestones, scaled to your level.</p>
            <input class="input mb-3" placeholder="e.g. a realtime chat app, an e-commerce store, a REST API for a blog" [(ngModel)]="goal" (keydown.enter)="generate()" />
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex gap-1.5">
                @for (d of diffs; track d) { <button class="chip" [class.chip-on]="difficulty() === d" (click)="difficulty.set(d)">{{ d }}</button> }
                <button class="chip" [class.chip-on]="difficulty() === null" (click)="difficulty.set(null)">auto</button>
              </div>
              <asta-btn variant="accent" size="sm" [loading]="generating()" [disabled]="goal.trim().length < 3" (click)="generate()">Generate blueprint</asta-btn>
            </div>
          </div>

          <div class="card" style="padding:18px">
            <p class="kicker mb-3">Your projects</p>
            @if (projects().length === 0) {
              <p class="text-sm text-txt-mute py-6 text-center">No projects yet — plan one above.</p>
            }
            <div class="grid gap-3 sm:grid-cols-2">
              @for (p of projects(); track p.id) {
                <button class="proj" (click)="openBoard(p.id)">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-semibold">{{ p.title }}</p>
                    <span class="status" [attr.data-s]="p.status">{{ p.status }}</span>
                  </div>
                  <div class="flex flex-wrap gap-1 my-2">@for (t of p.techStack; track t) { <span class="tag">{{ t }}</span> }</div>
                  <div class="bar"><div class="bar-fill" [style.width.%]="p.progressPercentage"></div></div>
                  <p class="text-[11px] text-txt-mute mt-1.5">{{ p.progressPercentage }}% · {{ p.difficulty }} · {{ p.estimatedWeeks }}w</p>
                </button>
              }
            </div>
          </div>
        </div>
      }

      @case ('board') {
        @if (project(); as p) {
          <div class="flex items-center justify-between gap-3 mb-4">
            <div>
              <button class="text-xs text-txt-mute hover:text-txt mb-1" (click)="backHome()">← All projects</button>
              <h1 class="text-[24px] leading-tight">{{ p.title }}</h1>
            </div>
            <div class="flex items-center gap-3">
              <asta-ring [value]="p.progressPercentage" [size]="64" />
            </div>
          </div>

          <!-- blueprint header -->
          <div class="grid gap-5 lg:grid-cols-3 mb-5">
            <asta-card class="lg:col-span-2">
              <p class="kicker mb-2">Blueprint</p>
              <p class="text-sm text-txt-soft mb-3">{{ p.summary }}</p>
              <div class="flex flex-wrap gap-1.5 mb-3">@for (t of p.techStack; track t) { <span class="pill">{{ t }}</span> }</div>
              <p class="text-[12px] text-txt-mute mb-1">Features</p>
              <ul class="text-sm text-txt-soft mb-3 space-y-0.5">@for (f of p.features; track f) { <li class="flex gap-2"><span style="color:var(--green-deep)">•</span>{{ f }}</li> }</ul>
              <p class="text-[12px] text-txt-mute mb-1">You'll learn</p>
              <div class="flex flex-wrap gap-1.5">@for (l of p.learningGoals; track l) { <span class="tag">{{ l }}</span> }</div>
            </asta-card>

            <asta-card accentVar="var(--peri)">
              <p class="kicker mb-3" style="color:var(--peri-deep)">Milestones</p>
              <ol class="space-y-2.5">
                @for (m of p.milestones; track m.title) {
                  <li class="flex items-start gap-2.5">
                    <span class="ms-dot" [class.ms-on]="m.reached"></span>
                    <div><p class="text-sm font-medium" [class.line-through]="m.reached" [style.opacity]="m.reached ? .6 : 1">{{ m.title }}</p><p class="text-[11px] text-txt-mute">{{ m.description }}</p></div>
                  </li>
                }
              </ol>
            </asta-card>
          </div>

          <!-- kanban -->
          <div class="grid gap-4 md:grid-cols-3 mb-5">
            @for (col of columns; track col.key) {
              <div class="kcol">
                <div class="flex items-center justify-between mb-2">
                  <p class="kicker">{{ col.label }}</p>
                  <span class="count">{{ tasksIn(col.key).length }}</span>
                </div>
                <div class="space-y-2">
                  @for (t of tasksIn(col.key); track t.id) {
                    <div class="kcard">
                      <p class="text-[13px] font-medium mb-1">{{ t.title }}</p>
                      @if (t.description) { <p class="text-[11px] text-txt-mute mb-1.5">{{ t.description }}</p> }
                      <div class="flex items-center justify-between">
                        <span class="phase">{{ t.phase }}</span>
                        <div class="flex gap-1">
                          @if (col.key !== 'todo') { <button class="mv" title="Move left" (click)="move(t, -1)">◀</button> }
                          @if (col.key !== 'done') { <button class="mv" title="Move right" (click)="move(t, 1)">▶</button> }
                        </div>
                      </div>
                    </div>
                  } @empty {
                    <p class="text-[12px] text-txt-mute py-3 text-center">—</p>
                  }
                  @if (col.key === 'todo') {
                    <div class="flex gap-1.5 mt-1">
                      <input class="input" style="font-size:12px;padding:6px 9px" placeholder="Add a task…" [(ngModel)]="newTask" (keydown.enter)="addTask()" />
                      <button class="mv" (click)="addTask()" [disabled]="!newTask.trim()">+</button>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- submit -->
          <asta-card accentVar="var(--green)">
            <p class="kicker mb-3">@if (p.submission?.submittedAt) { Submission } @else { Submit your project }</p>
            @if (p.submission?.submittedAt) {
              <p class="text-sm text-txt-soft mb-2">Submitted {{ ago(p.submission!.submittedAt!) }} ago.</p>
              <div class="flex flex-wrap gap-3 text-sm">
                @if (p.submission!.githubUrl) { <a class="lnk" [href]="p.submission!.githubUrl" target="_blank" rel="noopener">GitHub ↗</a> }
                @if (p.submission!.demoUrl) { <a class="lnk" [href]="p.submission!.demoUrl" target="_blank" rel="noopener">Live demo ↗</a> }
                @if (p.submission!.videoUrl) { <a class="lnk" [href]="p.submission!.videoUrl" target="_blank" rel="noopener">Video ↗</a> }
              </div>
              @if (p.submission!.notes) { <p class="text-sm text-txt-soft mt-2">{{ p.submission!.notes }}</p> }
            } @else {
              <div class="grid sm:grid-cols-3 gap-2 mb-2">
                <input class="input" placeholder="GitHub URL" [(ngModel)]="sub.githubUrl" />
                <input class="input" placeholder="Live demo URL" [(ngModel)]="sub.demoUrl" />
                <input class="input" placeholder="Video URL" [(ngModel)]="sub.videoUrl" />
              </div>
              <textarea class="input mb-2" rows="2" placeholder="Notes: what you built, decisions, what you'd improve…" [(ngModel)]="sub.notes"></textarea>
              <asta-btn variant="accent" size="sm" [loading]="submitting()" (click)="submit()">Mark complete & submit</asta-btn>
              <p class="text-[11px] text-txt-mute mt-2">Submitting marks every task done, completes the project, and runs an instant AI review.</p>
            }
          </asta-card>

          <!-- AI review (B8) -->
          @if (p.submission?.submittedAt) {
            <asta-card accentVar="var(--peri)" class="mt-5">
              <div class="flex items-center justify-between gap-3 mb-3">
                <p class="kicker" style="color:var(--peri-deep)">AI review</p>
                <button class="text-[11px] text-txt-mute hover:text-txt" [disabled]="reviewing()" (click)="rerunReview()">{{ reviewing() ? 'Reviewing…' : '↻ Re-run' }}</button>
              </div>
              @if (p.aiReview; as r) {
                <div class="flex items-center gap-4 mb-3">
                  <asta-ring [value]="r.overallScore" [size]="58" />
                  <p class="text-sm text-txt-soft">{{ r.summary }}</p>
                </div>
                <div class="grid sm:grid-cols-2 gap-x-5 gap-y-2 mb-4">
                  @for (s of scoreRows(r); track s.label) {
                    <div>
                      <div class="flex justify-between text-[11px] text-txt-mute mb-0.5"><span>{{ s.label }}</span><span>{{ s.value }}</span></div>
                      <div class="bar"><div class="bar-fill" [style.width.%]="s.value" style="background:var(--peri)"></div></div>
                    </div>
                  }
                </div>
                @if (r.strengths.length) {
                  <p class="text-[12px] text-txt-mute mb-1">Strengths</p>
                  <ul class="text-sm text-txt-soft mb-3 space-y-0.5">@for (s of r.strengths; track s) { <li class="flex gap-2"><span style="color:var(--green-deep)">✓</span>{{ s }}</li> }</ul>
                }
                @if (r.improvements.length) {
                  <p class="text-[12px] text-txt-mute mb-1.5">Improvement checklist</p>
                  <ul class="space-y-1.5">
                    @for (it of r.improvements; track it.id) {
                      <li class="imp" [class.imp-done]="it.done">
                        <input type="checkbox" [checked]="it.done" (change)="toggleImprovement(it.id, !it.done)" />
                        <span class="sev" [attr.data-s]="it.severity">{{ it.severity }}</span>
                        <span class="text-sm">{{ it.text }}</span>
                      </li>
                    }
                  </ul>
                }
                <p class="text-[10px] text-txt-mute mt-3 font-mono">reviewed by {{ r.model }} · {{ ago(r.reviewedAt) }} ago</p>
              } @else {
                <p class="text-sm text-txt-mute">No review yet — <button class="lnk" (click)="rerunReview()">run one now</button>.</p>
              }
            </asta-card>
          }

          <!-- Mentor review (B2) -->
          @if (p.mentorReview; as mr) {
            <asta-card accentVar="var(--green)" class="mt-5">
              <p class="kicker mb-2">Mentor review</p>
              <div class="flex items-center gap-2 mb-2">
                <span class="status" [attr.data-s]="mr.decision === 'approved' ? 'completed' : 'in_progress'">{{ mr.decision === 'approved' ? 'Approved' : 'Changes requested' }}</span>
                @if (mr.score != null) { <span class="text-[12px] text-txt-mute">{{ mr.score }}/100</span> }
                <span class="text-[11px] text-txt-mute">— {{ mr.reviewerName }}</span>
              </div>
              <p class="text-sm text-txt-soft">{{ mr.feedback }}</p>
            </asta-card>
          }
        }
      }
    }
  `,
  styles: [
    `
      .chip { font-family: var(--mono); font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); }
      .chip-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .proj { text-align: left; border: 1px solid var(--paper-3); border-radius: 14px; padding: 14px; background: var(--paper); transition: border-color .15s; }
      .proj:hover { border-color: var(--green); }
      .status { font-family: var(--mono); font-size: 10px; text-transform: uppercase; padding: 1px 7px; border-radius: 100px; background: var(--paper-2); color: var(--text-soft); }
      .status[data-s='completed'] { background: oklch(0.80 0.16 150 / .18); color: var(--green-deep); }
      .status[data-s='in_progress'] { background: oklch(0.78 0.15 268 / .15); color: var(--peri-deep); }
      .tag { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: var(--paper-2); color: var(--text-mute); }
      .bar { height: 6px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 100px; background: var(--green); transition: width .6s var(--ease); }
      .kcol { background: var(--paper-2); border-radius: 14px; padding: 12px; }
      .count { font-family: var(--mono); font-size: 11px; color: var(--text-mute); }
      .kcard { background: var(--paper); border: 1px solid var(--paper-3); border-radius: 10px; padding: 10px; }
      .phase { font-size: 10px; color: var(--text-mute); font-family: var(--mono); }
      .mv { width: 24px; height: 22px; border-radius: 6px; border: 1px solid var(--paper-3); background: var(--paper); font-size: 11px; color: var(--text-soft); }
      .mv:hover { border-color: var(--green); color: var(--green-deep); }
      .ms-dot { width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--paper-3); margin-top: 3px; flex-shrink: 0; }
      .ms-on { background: var(--green); border-color: var(--green); }
      .lnk { color: var(--green-deep); font-weight: 600; }
      .imp { display: flex; align-items: center; gap: 8px; }
      .imp-done { opacity: .5; text-decoration: line-through; }
      .imp input { accent-color: var(--green); }
      .sev { font-family: var(--mono); font-size: 9px; text-transform: uppercase; padding: 1px 6px; border-radius: 100px; background: var(--paper-2); color: var(--text-mute); flex-shrink: 0; }
      .sev[data-s='high'] { background: oklch(0.72 0.17 28 / .16); color: oklch(0.55 0.18 28); }
      .sev[data-s='medium'] { background: oklch(0.82 0.14 70 / .18); color: oklch(0.52 0.12 70); }
    `,
  ],
})
export class ProjectStudioComponent implements OnInit {
  private readonly api = inject(ProjectService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly confetti = inject(ConfettiService);

  readonly columns = COLUMNS;
  readonly diffs = DIFFS;
  readonly view = signal<View>('home');
  readonly projects = signal<Project[]>([]);
  readonly project = signal<Project | null>(null);
  readonly generating = signal(false);
  readonly submitting = signal(false);
  readonly reviewing = signal(false);

  readonly difficulty = signal<Difficulty | null>(null);
  goal = '';
  newTask = '';
  sub: { githubUrl?: string; demoUrl?: string; videoUrl?: string; notes?: string } = {};

  readonly tasksByCol = computed(() => {
    const p = this.project();
    const map: Record<TaskStatus, ProjectTask[]> = { todo: [], in_progress: [], done: [] };
    for (const t of (p?.tasks ?? []).slice().sort((a, b) => a.order - b.order)) map[t.status].push(t);
    return map;
  });

  ngOnInit(): void {
    this.refresh();
    const deepLink = this.route.snapshot.queryParamMap.get('projectId');
    if (deepLink) this.openBoard(deepLink);
  }

  refresh(): void {
    this.api.list().subscribe({ next: (p) => this.projects.set(p) });
  }

  generate(): void {
    if (this.goal.trim().length < 3 || this.generating()) return;
    this.generating.set(true);
    this.api.generate({ goal: this.goal.trim(), difficulty: this.difficulty() ?? undefined }).subscribe({
      next: (p) => {
        this.generating.set(false);
        this.goal = '';
        this.project.set(p);
        this.sub = {};
        this.view.set('board');
        this.refresh();
      },
      error: (e) => {
        this.generating.set(false);
        this.toast.error(e?.message ?? 'Could not generate project');
      },
    });
  }

  openBoard(id: string): void {
    this.api.get(id).subscribe({
      next: (p) => {
        this.project.set(p);
        this.sub = {};
        this.view.set('board');
      },
      error: () => this.toast.error('Could not load project'),
    });
  }

  tasksIn(col: TaskStatus): ProjectTask[] {
    return this.tasksByCol()[col];
  }

  move(task: ProjectTask, dir: -1 | 1): void {
    const order: TaskStatus[] = ['todo', 'in_progress', 'done'];
    const next = order[Math.max(0, Math.min(2, order.indexOf(task.status) + dir))];
    const p = this.project();
    if (!p || next === task.status) return;
    this.api.moveTask(p.id, task.id, next).subscribe({ next: (updated) => this.project.set(updated) });
  }

  addTask(): void {
    const p = this.project();
    if (!p || !this.newTask.trim()) return;
    this.api.addTask(p.id, this.newTask.trim()).subscribe({
      next: (updated) => {
        this.project.set(updated);
        this.newTask = '';
      },
    });
  }

  submit(): void {
    const p = this.project();
    if (!p) return;
    this.submitting.set(true);
    this.api.submit(p.id, this.sub).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.project.set(updated);
        this.toast.success('Project submitted 🎉');
        this.confetti.burst({ y: 0.4 });
        this.refresh();
      },
      error: (e) => {
        this.submitting.set(false);
        this.toast.error(e?.message ?? 'Could not submit');
      },
    });
  }

  scoreRows(r: AiProjectReview): { label: string; value: number }[] {
    return [
      { label: 'Quality', value: r.qualityScore },
      { label: 'Architecture', value: r.architectureScore },
      { label: 'Completeness', value: r.completenessScore },
      { label: 'Resume-ready', value: r.resumeScore },
    ];
  }

  rerunReview(): void {
    const p = this.project();
    if (!p || this.reviewing()) return;
    this.reviewing.set(true);
    this.api.requestAiReview(p.id).subscribe({
      next: (updated) => {
        this.reviewing.set(false);
        this.project.set(updated);
        this.toast.success('AI review updated');
      },
      error: (e) => {
        this.reviewing.set(false);
        this.toast.error(e?.message ?? 'Could not review');
      },
    });
  }

  toggleImprovement(itemId: string, done: boolean): void {
    const p = this.project();
    if (!p) return;
    this.api.toggleImprovement(p.id, itemId, done).subscribe({ next: (updated) => this.project.set(updated) });
  }

  backHome(): void {
    this.view.set('home');
    this.project.set(null);
    this.refresh();
  }

  ago(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m`;
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
}
