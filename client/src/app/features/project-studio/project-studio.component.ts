import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { AiProjectReview, Difficulty, Project, ProjectStats, ProjectTask, TaskStatus } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { ProgressComponent } from '../../shared/ui/progress.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { CountDirective } from '../../shared/directives/count.directive';

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
  imports: [
    FormsModule, ButtonComponent, CardComponent, RingComponent, ProgressComponent,
    MagneticDirective, CountDirective,
  ],
  template: `
    @switch (view()) {
      @case ('home') {
        <!-- Compact command header -->
        <header class="asta-page-command-header">
          <div class="min-w-0">
            <h1 class="text-[26px] leading-tight mb-2 grad-flow">Project Studio</h1>
            <span class="goal-pill"><span class="dot"></span>Project Forge · blueprint, board &amp; AI review</span>
          </div>
        </header>

        <div class="space-y-5">
          @if (stats(); as s) {
            @if (s.total > 0) {
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 motion-row-primary">
                <asta-card class="pstat motion-card-reveal" style="--motion-card-index:0"><p class="num"><span [astaCount]="s.total"></span></p><p class="lbl">Projects</p></asta-card>
                <asta-card class="pstat motion-card-reveal" style="--motion-card-index:1"><p class="num peri"><span [astaCount]="s.inProgress"></span></p><p class="lbl">In progress</p></asta-card>
                <asta-card class="pstat motion-card-reveal" style="--motion-card-index:2"><p class="num green"><span [astaCount]="s.submitted"></span></p><p class="lbl">Submitted</p></asta-card>
                <asta-card class="pstat motion-card-reveal" style="--motion-card-index:3"><p class="num"><span [astaCount]="s.avgProgress" suffix="%"></span></p><p class="lbl">Avg progress</p></asta-card>
              </div>
            }
          }
          <asta-card accentVar="var(--green)" class="motion-card-reveal motion-row-primary" style="--motion-card-index:0">
            <div class="panel-head mb-3">
              <p class="kicker">Plan a new project</p>
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </span>
            </div>
            <p class="text-sm text-txt-soft mb-3">Describe what you want to build — Asta designs a full blueprint: tech stack, features, a phased Kanban board and milestones, scaled to your level.</p>
            <input class="input mb-3" placeholder="e.g. a realtime chat app, an e-commerce store, a REST API for a blog" [(ngModel)]="goal" (keydown.enter)="generate()" />
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex gap-1.5">
                @for (d of diffs; track d) { <button class="chip" [class.chip-on]="difficulty() === d" (click)="difficulty.set(d)">{{ d }}</button> }
                <button class="chip" [class.chip-on]="difficulty() === null" (click)="difficulty.set(null)">auto</button>
              </div>
              <asta-btn variant="accent" size="sm" astaMagnetic [loading]="generating()" [disabled]="goal.trim().length < 3" (click)="generate()">Generate blueprint <span class="arr">→</span></asta-btn>
            </div>
          </asta-card>

          <asta-card class="motion-card-reveal motion-strip" style="--motion-card-index:0">
            <div class="panel-head mb-3">
              <p class="kicker">Your projects</p>
              @if (archivedCount() > 0) {
                <button class="arch-toggle" (click)="showArchived.set(!showArchived())">{{ showArchived() ? 'Hide archived' : 'Show archived (' + archivedCount() + ')' }}</button>
              }
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
              </span>
            </div>
            @if (projects().length > 3) {
              <div class="ps-toolbar">
                <input class="ps-search" [ngModel]="projQuery()" (ngModelChange)="projQuery.set($event)" placeholder="Search projects…" aria-label="Search projects" />
                <div class="ps-chips">
                  <button class="chip" [class.chip-on]="projStatus() === 'all'" (click)="projStatus.set('all')">all</button>
                  @for (st of projStatuses(); track st) {
                    <button class="chip" [class.chip-on]="projStatus() === st" (click)="projStatus.set(st)">{{ st }}</button>
                  }
                </div>
              </div>
            }
            @if (visibleProjects().length === 0) {
              <p class="text-sm text-txt-mute py-6 text-center">{{ projects().length === 0 ? 'No projects yet — plan one above.' : ((projQuery() || projStatus() !== 'all') ? 'No projects match your search or filter.' : 'No active projects — all archived.') }}</p>
            }
            <div class="grid gap-3 sm:grid-cols-2">
              @for (p of visibleProjects(); track p.id) {
                <div class="proj" [class.archived]="p.archived" (click)="openBoard(p.id)" (keyup.enter)="openBoard(p.id)" role="button" tabindex="0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-semibold">{{ p.title }}</p>
                    <span class="status" [attr.data-s]="p.status">{{ p.status }}</span>
                  </div>
                  <div class="flex flex-wrap gap-1 my-2">@for (t of p.techStack; track t) { <span class="tag">{{ t }}</span> }</div>
                  <asta-progress [value]="p.progressPercentage" />
                  <div class="flex items-center justify-between mt-1.5">
                    <p class="text-[11px] text-txt-mute"><span [astaCount]="p.progressPercentage" suffix="%"></span> · {{ p.difficulty }} · {{ p.estimatedWeeks }}w</p>
                    <div class="flex items-center gap-2">
                      @if (p.archived) { <button class="arch-btn del" (click)="deleteProject(p); $event.stopPropagation()">Delete</button> }
                      <button class="arch-btn" (click)="toggleArchive(p); $event.stopPropagation()">{{ p.archived ? 'Restore' : 'Archive' }}</button>
                    </div>
                  </div>
                </div>
              }
            </div>
          </asta-card>
        </div>
      }

      @case ('board') {
        @if (project(); as p) {
          <!-- Compact command header -->
          <header class="asta-page-command-header">
            <div class="min-w-0">
              <button class="back-link mb-1" (click)="backHome()"><span class="arr-back">←</span> All projects</button>
              <h1 class="text-[26px] leading-tight grad-flow">{{ p.title }}</h1>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <asta-ring [value]="p.progressPercentage" [size]="64" />
            </div>
          </header>

          <!-- blueprint header -->
          <div class="grid gap-5 lg:grid-cols-3 mb-5 motion-row-primary">
            <asta-card class="lg:col-span-2 motion-card-reveal" style="--motion-card-index:0">
              <div class="panel-head mb-2">
                <p class="kicker">Blueprint</p>
                <span class="panel-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </span>
              </div>
              <p class="text-sm text-txt-soft mb-3">{{ p.summary }}</p>
              <div class="flex flex-wrap gap-1.5 mb-3">@for (t of p.techStack; track t) { <span class="pill">{{ t }}</span> }</div>
              <p class="text-[12px] text-txt-mute mb-1">Features</p>
              <ul class="text-sm text-txt-soft mb-3 space-y-0.5">@for (f of p.features; track f) { <li class="flex gap-2"><span style="color:var(--green-deep)">•</span>{{ f }}</li> }</ul>
              <p class="text-[12px] text-txt-mute mb-1">You'll learn</p>
              <div class="flex flex-wrap gap-1.5">@for (l of p.learningGoals; track l) { <span class="tag">{{ l }}</span> }</div>
            </asta-card>

            <asta-card accentVar="var(--peri)" class="motion-card-reveal" style="--motion-card-index:1">
              <div class="panel-head mb-3">
                <p class="kicker" style="color:var(--peri-deep)">Milestones</p>
                <span class="panel-ico peri" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                </span>
              </div>
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
          <div class="grid gap-4 md:grid-cols-3 mb-5 motion-row-panel">
            @for (col of columns; track col.key; let i = $index) {
              <div class="kcol motion-card-reveal" [style.--motion-card-index]="i">
                <div class="flex items-center justify-between mb-2">
                  <p class="kicker">{{ col.label }}</p>
                  <span class="count">{{ tasksIn(col.key).length }}</span>
                </div>
                <div class="space-y-2">
                  @for (t of tasksIn(col.key); track t.id; let ti = $index, last = $last) {
                    <div class="kcard">
                      <p class="text-[13px] font-medium mb-1">{{ t.title }}</p>
                      @if (t.description) { <p class="text-[11px] text-txt-mute mb-1.5">{{ t.description }}</p> }
                      <div class="flex items-center justify-between">
                        <span class="phase">{{ t.phase }}</span>
                        <div class="flex gap-1">
                          <button class="mv" title="Move up" aria-label="Move task up" [disabled]="ti === 0" (click)="reorder(t, 'up')">▲</button>
                          <button class="mv" title="Move down" aria-label="Move task down" [disabled]="last" (click)="reorder(t, 'down')">▼</button>
                          @if (col.key !== 'todo') { <button class="mv" title="Move left" aria-label="Move task to previous column" (click)="move(t, -1)">◀</button> }
                          @if (col.key !== 'done') { <button class="mv" title="Move right" aria-label="Move task to next column" (click)="move(t, 1)">▶</button> }
                          <button class="mv del" title="Delete task" aria-label="Delete task" (click)="removeTask(t)">✕</button>
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
          <asta-card accentVar="var(--green)" class="motion-card-reveal motion-lower" style="--motion-card-index:0">
            <div class="panel-head mb-3">
              <p class="kicker">@if (p.submission?.submittedAt) { Submission } @else { Submit your project }</p>
              <span class="panel-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>
              </span>
            </div>
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
              <asta-btn variant="accent" size="sm" astaMagnetic [loading]="submitting()" (click)="submit()">Mark complete &amp; submit <span class="arr">→</span></asta-btn>
              <p class="text-[11px] text-txt-mute mt-2">Submitting marks every task done, completes the project, and runs an instant AI review.</p>
            }
          </asta-card>

          <!-- AI review (B8) -->
          @if (p.submission?.submittedAt) {
            <asta-card accentVar="var(--peri)" class="mt-5 motion-card-reveal motion-lower" style="--motion-card-index:1">
              <div class="panel-head mb-3">
                <div class="flex items-center gap-3">
                  <span class="panel-ico peri" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z"/><path d="M9 21h6"/></svg>
                  </span>
                  <p class="kicker" style="color:var(--peri-deep)">AI review</p>
                </div>
                <button class="text-[11px] text-txt-mute hover:text-txt" [disabled]="reviewing()" (click)="rerunReview()">{{ reviewing() ? 'Reviewing…' : '↻ Re-run' }}</button>
              </div>
              @if (p.aiReview; as r) {
                <div class="flex items-center gap-4 mb-4">
                  <asta-ring [value]="r.overallScore" [size]="58" tone="peri" />
                  <p class="text-sm text-txt-soft">{{ r.summary }}</p>
                </div>
                <div class="grid sm:grid-cols-2 gap-x-5 gap-y-3 mb-4">
                  @for (s of scoreRows(r); track s.label) {
                    <div>
                      <div class="flex justify-between text-[11px] text-txt-mute mb-1"><span>{{ s.label }}</span><span [astaCount]="s.value"></span></div>
                      <asta-progress [value]="s.value" tone="peri" />
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

          <!-- Case study (Phase 9 · portfolio writeup) -->
          @if (p.submission?.submittedAt) {
            <asta-card class="mt-5 motion-card-reveal motion-lower" style="--motion-card-index:3">
              <div class="panel-head mb-3">
                <p class="kicker">Portfolio case study</p>
                <span class="panel-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </span>
              </div>
              @if (p.caseStudy) {
                <pre class="case-text">{{ p.caseStudy }}</pre>
                <div class="flex gap-2 mt-3">
                  <asta-btn variant="ghost" size="sm" (click)="copyCaseStudy()">Copy</asta-btn>
                  <asta-btn variant="ghost" size="sm" [loading]="buildingCase()" (click)="generateCaseStudy()">Regenerate</asta-btn>
                </div>
              } @else {
                <p class="text-sm text-txt-soft mb-3">Turn this project into a polished, portfolio-ready writeup — problem, approach, stack and outcome — that you can drop straight into your portfolio or résumé.</p>
                <asta-btn variant="accent" size="sm" astaMagnetic [loading]="buildingCase()" (click)="generateCaseStudy()">Generate case study <span class="arr">→</span></asta-btn>
              }
            </asta-card>
          }

          <!-- Mentor review (B2) -->
          @if (p.mentorReview; as mr) {
            <asta-card accentVar="var(--green)" class="mt-5 motion-card-reveal motion-lower" style="--motion-card-index:2">
              <div class="panel-head mb-2">
                <p class="kicker">Mentor review</p>
                <span class="panel-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
              </div>
              <div class="flex items-center gap-2 mb-2">
                <span class="status" [attr.data-s]="mr.decision === 'approved' ? 'completed' : 'in_progress'">{{ mr.decision === 'approved' ? 'Approved' : 'Changes requested' }}</span>
                @if (mr.score !== null) { <span class="text-[12px] text-txt-mute">{{ mr.score }}/100</span> }
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
      .chip { font-family: var(--mono); font-size: 11px; text-transform: uppercase; padding: 5px 11px; border-radius: 100px; border: 1px solid color-mix(in oklch, var(--paper-3) 70%, transparent); background: color-mix(in oklch, var(--paper-2) 55%, transparent); color: var(--text-soft); cursor: pointer; transition: transform .15s var(--ease-spring), border-color .15s var(--ease), color .15s var(--ease); }
      .chip:hover { color: var(--text); border-color: color-mix(in oklch, var(--green) 38%, transparent); transform: translateY(-1px); }
      .chip-on { background: linear-gradient(135deg, var(--green), var(--green-deep)); color: #06100a; border-color: transparent; box-shadow: 0 4px 12px var(--asta-accent-glow); }
      .chip-on:hover { color: #06100a; transform: translateY(-1px); }
      .proj { text-align: left; border: 1px solid var(--paper-3); border-radius: 14px; padding: 14px; background: var(--paper); transition: border-color .15s; cursor: pointer; }
      .proj:hover { border-color: var(--green); }
      .proj.archived { opacity: .6; }
      .arch-toggle { margin-left: auto; margin-right: 10px; font-size: 11px; color: var(--text-mute); background: transparent; border: none; cursor: pointer; }
      .arch-toggle:hover { color: var(--text); }
      .arch-btn { font-size: 10.5px; color: var(--text-mute); background: transparent; border: none; cursor: pointer; }
      .arch-btn:hover { color: var(--text); }
      .arch-btn.del:hover { color: var(--danger, #ff5d5d); }
      .ps-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
      .ps-search { flex: 1; min-width: 180px; padding: 8px 12px; font-size: 13px; color: var(--text); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 11px; }
      .ps-search:focus { outline: none; border-color: var(--green); }
      .ps-chips { display: flex; flex-wrap: wrap; gap: 6px; }
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
      .mv.del:hover { border-color: var(--coral, #ffb454); color: var(--coral-deep); }
      .pstat { text-align: center; padding: 14px 10px; }
      .pstat .num { font-size: 26px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
      .pstat .num.green { color: var(--green-deep); }
      .pstat .num.peri { color: var(--peri-deep); }
      .pstat .lbl { font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
      .case-text { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 10px; padding: 12px 14px; max-height: 360px; overflow: auto; color: var(--text-soft); }
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
  readonly showArchived = signal(false);
  readonly projQuery = signal('');
  readonly projStatus = signal<string>('all');
  readonly archivedCount = computed(() => this.projects().filter((p) => p.archived).length);
  readonly projStatuses = computed(() =>
    [...new Set(this.projects().map((p) => p.status))].sort((a, b) => a.localeCompare(b)),
  );
  readonly visibleProjects = computed(() => {
    const needle = this.projQuery().trim().toLowerCase();
    const status = this.projStatus();
    return this.projects().filter((p) => {
      if (!this.showArchived() && p.archived) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (needle && !`${p.title} ${p.techStack.join(' ')}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  });
  readonly stats = signal<ProjectStats | null>(null);
  readonly project = signal<Project | null>(null);
  readonly generating = signal(false);
  readonly submitting = signal(false);
  readonly reviewing = signal(false);
  readonly buildingCase = signal(false);

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
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => undefined });
  }

  removeTask(task: ProjectTask): void {
    const p = this.project();
    if (!p) return;
    this.api.removeTask(p.id, task.id).subscribe({ next: (updated) => this.project.set(updated) });
  }

  generateCaseStudy(): void {
    const p = this.project();
    if (!p || this.buildingCase()) return;
    this.buildingCase.set(true);
    this.api.generateCaseStudy(p.id).subscribe({
      next: (updated) => {
        this.buildingCase.set(false);
        this.project.set(updated);
        this.toast.success('Case study ready — portfolio-ready writeup');
      },
      error: (e) => {
        this.buildingCase.set(false);
        this.toast.error(e?.message ?? 'Could not generate case study');
      },
    });
  }

  copyCaseStudy(): void {
    const text = this.project()?.caseStudy;
    if (!text) return;
    void navigator.clipboard?.writeText(text).then(
      () => this.toast.success('Copied to clipboard'),
      () => this.toast.error('Could not copy'),
    );
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

  toggleArchive(p: Project): void {
    this.api.setArchived(p.id, !p.archived).subscribe({
      next: (updated) => {
        this.projects.set(this.projects().map((x) => (x.id === updated.id ? updated : x)));
        this.toast.success(updated.archived ? 'Project archived' : 'Project restored');
      },
      error: () => this.toast.error('Could not update project'),
    });
  }

  deleteProject(p: Project): void {
    this.api.remove(p.id).subscribe({
      next: () => {
        this.projects.set(this.projects().filter((x) => x.id !== p.id));
        this.toast.success('Project deleted');
      },
      error: () => this.toast.error('Could not delete project'),
    });
  }

  reorder(task: ProjectTask, direction: 'up' | 'down'): void {
    const p = this.project();
    if (!p) return;
    this.api.reorderTask(p.id, task.id, direction).subscribe({
      next: (updated) => this.project.set(updated),
      error: () => this.toast.error('Could not reorder task'),
    });
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
