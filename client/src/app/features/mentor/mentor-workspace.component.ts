import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MentorService } from '../../core/services/mentor.service';
import { ToastService } from '../../core/services/toast.service';
import { MentorDashboard, MentorProfile, PendingReview, StudentDetail, StudentSummary } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { CountDirective } from '../../shared/directives/count.directive';

interface ReviewDraft {
  decision: 'approved' | 'changes_requested';
  feedback: string;
  score?: number;
}

@Component({
  selector: 'asta-mentor-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, RingComponent, EmptyStateComponent, MagneticDirective, CountDirective],
  template: `
    @if (loading()) {
      <header class="asta-page-command-header">
        <div class="min-w-0">
          <h1 class="text-[26px] leading-tight mb-2 grad-flow">Mentor Room</h1>
          <span class="goal-pill"><span class="dot"></span>Loading your assigned students…</span>
        </div>
      </header>
      <asta-card><p class="text-sm text-txt-mute py-10 text-center">Loading your students…</p></asta-card>
    } @else {
      @if (dash(); as d) {
      <!-- Compact command header -->
      <header class="asta-page-command-header">
        <div class="min-w-0">
          <h1 class="text-[26px] leading-tight mb-2 grad-flow">Mentor Room</h1>
          <span class="goal-pill"><span class="dot"></span>{{ d.students.length }} assigned · {{ d.atRiskCount }} need attention</span>
        </div>
        <div class="flex gap-2.5 shrink-0 items-center">
          <asta-btn variant="ghost" size="sm" (click)="toggleProfile()">{{ showProfile() ? 'Close profile' : 'My profile' }}</asta-btn>
          <div class="hstat"><span class="hstat-n" [astaCount]="d.students.length"></span><span class="hstat-l">Students</span></div>
          <div class="hstat"><span class="hstat-n" style="color:var(--coral-deep)" [astaCount]="d.atRiskCount"></span><span class="hstat-l">At risk</span></div>
          <div class="hstat"><span class="hstat-n" [astaCount]="d.pendingReviews.length"></span><span class="hstat-l">Reviews</span></div>
        </div>
      </header>

      @if (showProfile()) {
        <asta-card class="block mb-5 motion-card-reveal">
          <div class="panel-head mb-3">
            <p class="kicker">Your mentor profile</p>
            <span class="text-[11px] text-txt-mute">Shown to students in the mentor marketplace</span>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="block md:col-span-2"><span class="t-label">Headline</span>
              <input class="input mt-1" [ngModel]="pf.headline" (ngModelChange)="pf.headline = $event" placeholder="e.g. Senior Frontend Engineer · ex-Google" maxlength="120" /></label>
            <label class="block md:col-span-2"><span class="t-label">Bio</span>
              <textarea class="input mt-1" rows="3" [ngModel]="pf.bio" (ngModelChange)="pf.bio = $event" placeholder="A short bio students will see…" maxlength="600"></textarea></label>
            <label class="block"><span class="t-label">Skills (comma-separated)</span>
              <input class="input mt-1" [ngModel]="skillsStr()" (ngModelChange)="skillsStr.set($event)" placeholder="React, System Design, DSA" /></label>
            <label class="block"><span class="t-label">Languages (comma-separated)</span>
              <input class="input mt-1" [ngModel]="langsStr()" (ngModelChange)="langsStr.set($event)" placeholder="English, Hindi" /></label>
            <label class="block"><span class="t-label">Experience (years)</span>
              <input type="number" min="0" max="60" class="input mt-1" [ngModel]="pf.experienceYears" (ngModelChange)="pf.experienceYears = +$event" /></label>
            <label class="block"><span class="t-label">Availability</span>
              <input class="input mt-1" [ngModel]="pf.availability" (ngModelChange)="pf.availability = $event" placeholder="e.g. Weekends, 2 slots/week" maxlength="120" /></label>
          </div>
          <div class="mt-3"><asta-btn variant="accent" size="sm" astaMagnetic [loading]="profileBusy()" (click)="saveProfile()">Save profile <span class="arr">→</span></asta-btn></div>
        </asta-card>
      }

      @if (d.students.length === 0 && d.pendingReviews.length === 0) {
        <asta-card><asta-empty-state title="No students assigned yet" description="You'll see students from organizations where you're a mentor, instructor or admin. Ask an org admin to add you, or invite students to your org." /></asta-card>
      } @else {
        <!-- weekly actions -->
        <asta-card accentVar="var(--peri)" class="block mb-5 motion-row-primary motion-card-reveal" style="--motion-card-index:0">
          <div class="panel-head">
            <p class="kicker" style="color:var(--peri-deep)">This week</p>
            <span class="panel-ico peri" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
          </div>
          <ul class="space-y-1.5 text-sm text-txt-soft mt-3">
            @for (a of d.weeklyActions; track a) { <li class="flex gap-2"><span class="arr" style="color:var(--peri-deep)">→</span><span>{{ a }}</span></li> }
          </ul>
        </asta-card>

        <div class="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr] motion-row-2">
          <!-- student list -->
          <div class="card motion-card-reveal" style="padding:14px;--motion-card-index:0">
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
          <div class="motion-card-reveal" style="--motion-card-index:1">
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
                  <div class="panel-head mb-3">
                    <p class="kicker">Project submissions</p>
                    <span class="panel-ico green" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>
                    </span>
                  </div>
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
                        <asta-btn variant="accent" size="sm" astaMagnetic [disabled]="!draftFor(p.projectId).feedback.trim()" (click)="submitReview(p)">Submit review <span class="arr">→</span></asta-btn>
                      </div>
                    }
                  </div>
                </asta-card>
              }

              <!-- notes -->
              <asta-card>
                <div class="panel-head mb-3">
                  <p class="kicker">Mentor notes</p>
                  <span class="panel-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  </span>
                </div>
                <div class="flex items-end gap-2 mb-3">
                  <textarea class="input" rows="2" placeholder="Add a private note about this student…" [(ngModel)]="noteDraft"></textarea>
                  <asta-btn variant="accent" size="sm" astaMagnetic [disabled]="!noteDraft.trim()" (click)="addNote(det.summary.userId)">Add</asta-btn>
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
      } @else if (loadError()) {
      <header class="asta-page-command-header">
        <div class="min-w-0">
          <h1 class="text-[26px] leading-tight mb-2 grad-flow">Mentor Room</h1>
          <span class="goal-pill"><span class="dot"></span>Couldn't load your room</span>
        </div>
      </header>
      <asta-card class="block motion-row-primary motion-card-reveal" style="--motion-card-index:0">
        <asta-empty-state title="We couldn't load your mentor room" description="Something went wrong fetching your assigned students. Please try again.">
          <asta-btn variant="accent" size="sm" astaMagnetic (click)="load()">Retry <span class="arr">→</span></asta-btn>
        </asta-empty-state>
      </asta-card>
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
  readonly loadError = signal(false);

  noteDraft = '';
  private drafts = new Map<string, ReviewDraft>();

  // ── mentor profile (server-backed: GET/PUT /mentor/profile) ──
  readonly showProfile = signal(false);
  readonly profileBusy = signal(false);
  readonly skillsStr = signal('');
  readonly langsStr = signal('');
  private profileLoaded = false;
  pf: MentorProfile = { headline: '', bio: '', skills: [], languages: [], experienceYears: 0, availability: '' };

  ngOnInit(): void {
    this.load();
  }

  toggleProfile(): void {
    const next = !this.showProfile();
    this.showProfile.set(next);
    if (next && !this.profileLoaded) {
      this.api.getProfile().subscribe({
        next: (p) => {
          this.profileLoaded = true;
          if (p) {
            this.pf = { ...this.pf, ...p };
            this.skillsStr.set((p.skills ?? []).join(', '));
            this.langsStr.set((p.languages ?? []).join(', '));
          }
        },
      });
    }
  }

  saveProfile(): void {
    const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const payload: MentorProfile = {
      ...this.pf,
      skills: csv(this.skillsStr()),
      languages: csv(this.langsStr()),
      experienceYears: Math.max(0, this.pf.experienceYears || 0),
    };
    this.profileBusy.set(true);
    this.api.saveProfile(payload).subscribe({
      next: (p) => {
        this.pf = { ...this.pf, ...p };
        this.skillsStr.set((p.skills ?? []).join(', '));
        this.langsStr.set((p.languages ?? []).join(', '));
        this.profileLoaded = true;
        this.profileBusy.set(false);
        this.toast.success('Mentor profile saved');
      },
      error: (e) => { this.profileBusy.set(false); this.toast.error(e?.message ?? 'Could not save profile'); },
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.dashboard().subscribe({
      next: (d) => {
        this.dash.set(d);
        this.loading.set(false);
        if (d.students[0]) this.select(d.students[0]);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
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
