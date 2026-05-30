import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MentorService } from '../../core/services/mentor.service';
import { ToastService } from '../../core/services/toast.service';
import { MentorDashboard, PendingReview, Risk, StudentDetail, StudentSummary } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

interface ReviewDraft {
  decision: 'approved' | 'changes_requested';
  feedback: string;
  score?: number;
}

@Component({
  selector: 'asta-mentor-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, RingComponent, EmptyStateComponent],
  template: `
    <h1 class="text-[26px] mb-1">Mentor Room</h1>
    <p class="text-sm text-txt-mute mb-6">Your students, their risk signals, and what needs your attention this week.</p>

    @if (loading()) {
      <asta-card><p class="text-sm text-txt-mute py-8 text-center">Loading your students…</p></asta-card>
    } @else {
      @if (dash(); as d) {
      @if (d.students.length === 0 && d.pendingReviews.length === 0) {
        <asta-card><asta-empty-state title="No students assigned yet" description="You'll see students from organizations where you're a mentor, instructor or admin. Ask an org admin to add you, or invite students to your org." /></asta-card>
      } @else {
        <!-- weekly actions + stats -->
        <div class="grid gap-4 md:grid-cols-3 mb-5">
          <asta-card accentVar="var(--peri)" class="md:col-span-2">
            <p class="kicker mb-2" style="color:var(--peri-deep)">This week</p>
            <ul class="space-y-1.5 text-sm text-txt-soft">
              @for (a of d.weeklyActions; track a) { <li class="flex gap-2"><span style="color:var(--peri-deep)">→</span>{{ a }}</li> }
            </ul>
          </asta-card>
          <div class="grid grid-cols-3 gap-3">
            <div class="card stat"><p class="font-display text-2xl">{{ d.students.length }}</p><p class="lbl">Students</p></div>
            <div class="card stat"><p class="font-display text-2xl" style="color:var(--coral-deep)">{{ d.atRiskCount }}</p><p class="lbl">At risk</p></div>
            <div class="card stat"><p class="font-display text-2xl">{{ d.pendingReviews.length }}</p><p class="lbl">Reviews</p></div>
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <!-- student list -->
          <div class="card" style="padding:14px">
            <p class="kicker mb-3">Your students</p>
            <div class="space-y-2">
              @for (s of d.students; track s.userId) {
                <button class="stu" [class.stu-on]="selectedId() === s.userId" (click)="select(s)">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-medium truncate">{{ s.name }}</p>
                    <span class="risk" [attr.data-r]="s.risk">{{ s.risk }}</span>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-[11px] text-txt-mute">
                    <span>health {{ s.health }}%</span><span>readiness {{ s.readiness }}%</span>
                    @if (s.activeDays === 0) { <span style="color:var(--coral-deep)">inactive</span> }
                  </div>
                </button>
              } @empty {
                <p class="text-sm text-txt-mute py-4 text-center">No students yet.</p>
              }
            </div>
          </div>

          <!-- detail -->
          <div>
            @if (detail(); as det) {
              <asta-card class="block mb-4">
                <div class="flex items-start gap-4">
                  <asta-ring [value]="det.summary.health" [size]="76" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h2 class="text-[18px] font-display font-semibold">{{ det.summary.name }}</h2>
                      <span class="risk" [attr.data-r]="det.summary.risk">{{ det.summary.risk }} risk</span>
                    </div>
                    <p class="text-sm text-txt-soft mb-2">{{ det.summary.summary }}</p>
                    <div class="flex flex-wrap gap-1.5">
                      @for (s of det.summary.strengths; track s) { <span class="pill" style="color:var(--green-deep);border-color:var(--green)">{{ s }}</span> }
                      @if (det.summary.topWeakness) { <span class="pill" style="color:var(--coral-deep);border-color:var(--coral)">gap: {{ det.summary.topWeakness }}</span> }
                    </div>
                  </div>
                </div>
              </asta-card>

              <!-- submissions -->
              @if (det.projects.length) {
                <asta-card class="block mb-4">
                  <p class="kicker mb-3">Project submissions</p>
                  <div class="space-y-3">
                    @for (p of det.projects; track p.projectId) {
                      <div class="sub">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                          <p class="text-sm font-medium">{{ p.title }}</p>
                          <div class="flex gap-2 text-[12px]">
                            @if (p.githubUrl) { <a class="lnk" [href]="p.githubUrl" target="_blank" rel="noopener">GitHub ↗</a> }
                            @if (p.demoUrl) { <a class="lnk" [href]="p.demoUrl" target="_blank" rel="noopener">Demo ↗</a> }
                          </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                          <button class="seg" [class.seg-on]="draftFor(p.projectId).decision === 'approved'" (click)="setDecision(p.projectId, 'approved')">Approve</button>
                          <button class="seg" [class.seg-on]="draftFor(p.projectId).decision === 'changes_requested'" (click)="setDecision(p.projectId, 'changes_requested')">Request changes</button>
                          <input type="number" class="input" style="width:80px" min="0" max="100" placeholder="score" [ngModel]="draftFor(p.projectId).score" (ngModelChange)="setScore(p.projectId, $event)" />
                        </div>
                        <textarea class="input mb-2" rows="2" placeholder="Feedback for the student…" [ngModel]="draftFor(p.projectId).feedback" (ngModelChange)="setFeedback(p.projectId, $event)"></textarea>
                        <asta-btn variant="accent" size="sm" [disabled]="!draftFor(p.projectId).feedback.trim()" (click)="submitReview(p)">Submit review</asta-btn>
                      </div>
                    }
                  </div>
                </asta-card>
              }

              <!-- notes -->
              <asta-card>
                <p class="kicker mb-3">Mentor notes</p>
                <div class="flex items-end gap-2 mb-3">
                  <textarea class="input" rows="2" placeholder="Add a private note about this student…" [(ngModel)]="noteDraft"></textarea>
                  <asta-btn variant="accent" size="sm" [disabled]="!noteDraft.trim()" (click)="addNote(det.summary.userId)">Add</asta-btn>
                </div>
                @if (det.notes.length === 0) { <p class="text-sm text-txt-mute">No notes yet.</p> }
                <div class="space-y-2">
                  @for (n of det.notes; track n.id) {
                    <div class="note"><p class="text-sm">{{ n.content }}</p><p class="text-[11px] text-txt-mute mt-1">{{ day(n.createdAt) }}</p></div>
                  }
                </div>
              </asta-card>
            } @else {
              <asta-card><p class="text-sm text-txt-mute py-10 text-center">Select a student to see their AI summary, notes and submissions.</p></asta-card>
            }
          </div>
        </div>
      }
      }
    }
  `,
  styles: [
    `
      .stat { padding: 10px 12px; }
      .lbl { font-size: 10px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
      .stu { width: 100%; text-align: left; border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 12px; background: var(--paper); transition: border-color .15s; }
      .stu:hover { border-color: var(--peri); }
      .stu-on { border-color: var(--peri); background: oklch(0.78 0.15 268 / .06); }
      .risk { font-family: var(--mono); font-size: 10px; text-transform: uppercase; padding: 1px 7px; border-radius: 100px; }
      .risk[data-r='high'] { background: oklch(0.72 0.17 25 / .16); color: var(--coral-deep); }
      .risk[data-r='medium'] { background: oklch(0.78 0.16 38 / .18); color: oklch(0.5 0.16 38); }
      .risk[data-r='low'] { background: oklch(0.80 0.16 150 / .18); color: var(--green-deep); }
      .sub { border: 1px solid var(--paper-3); border-radius: 12px; padding: 12px; }
      .seg { font-size: 12px; padding: 4px 12px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); }
      .seg-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .note { border-left: 2px solid var(--paper-3); padding: 4px 0 4px 10px; }
      .lnk { color: var(--green-deep); font-weight: 600; }
    `,
  ],
})
export class MentorWorkspaceComponent implements OnInit {
  private readonly api = inject(MentorService);
  private readonly toast = inject(ToastService);

  readonly dash = signal<MentorDashboard | null>(null);
  readonly detail = signal<StudentDetail | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly loading = signal(true);

  noteDraft = '';
  private drafts = new Map<string, ReviewDraft>();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.dashboard().subscribe({
      next: (d) => {
        this.dash.set(d);
        this.loading.set(false);
        if (d.students[0]) this.select(d.students[0]);
      },
      error: () => this.loading.set(false),
    });
  }

  select(s: StudentSummary): void {
    this.selectedId.set(s.userId);
    this.detail.set(null);
    this.noteDraft = '';
    this.api.student(s.userId).subscribe({ next: (det) => this.detail.set(det), error: () => this.toast.error('Could not load student') });
  }

  draftFor(projectId: string): ReviewDraft {
    if (!this.drafts.has(projectId)) this.drafts.set(projectId, { decision: 'approved', feedback: '' });
    return this.drafts.get(projectId)!;
  }
  setDecision(id: string, d: 'approved' | 'changes_requested'): void {
    this.draftFor(id).decision = d;
  }
  setFeedback(id: string, v: string): void {
    this.draftFor(id).feedback = v;
  }
  setScore(id: string, v: number): void {
    this.draftFor(id).score = v;
  }

  submitReview(p: PendingReview): void {
    const draft = this.draftFor(p.projectId);
    this.api.reviewProject(p.projectId, draft.decision, draft.feedback, draft.score).subscribe({
      next: () => {
        this.toast.success(`Review submitted — ${draft.decision === 'approved' ? 'approved' : 'changes requested'}`);
        const id = this.selectedId();
        if (id) this.api.student(id).subscribe({ next: (det) => this.detail.set(det) });
        this.load();
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not submit review'),
    });
  }

  day(iso: string): string {
    return iso ? iso.slice(0, 10) : '';
  }

  addNote(studentId: string): void {
    if (!this.noteDraft.trim()) return;
    this.api.addNote(studentId, this.noteDraft.trim()).subscribe({
      next: () => {
        this.noteDraft = '';
        this.toast.success('Note added');
        this.api.student(studentId).subscribe({ next: (det) => this.detail.set(det) });
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not add note'),
    });
  }
}
