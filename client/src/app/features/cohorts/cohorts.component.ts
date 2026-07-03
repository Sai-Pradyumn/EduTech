import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CohortService, PeerLeaderboard } from '../../core/services/cohort.service';
import { OrgService } from '../../core/services/org.service';
import { OrgContextService } from '../../core/services/org-context.service';
import { ToastService } from '../../core/services/toast.service';
import { CohortDetail, CohortStatus, CohortView, LeaderboardRow, OrgMember } from '../../core/models';
import { ProgressComponent } from '../../shared/ui/progress.component';

/**
 * Cohort-based learning (B3). Students see the cohorts they belong to; org admins
 * (cohort.create) can create cohorts, manage members, post announcements and view
 * an LI-powered leaderboard. Master-detail; tenant-scoped via the active org.
 */
@Component({
    selector: 'asta-cohorts',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, DatePipe, ProgressComponent],
    template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Cohorts</h1>
        <span class="goal-pill"><span class="dot"></span>Learn together · leaderboards, announcements & members</span>
      </div>
    </header>

    <div class="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <!-- Left: lists + create -->
      <div class="space-y-5">
        @if (canManage()) {
          <div class="card" style="padding:16px">
            <p class="kicker mb-3" style="color:var(--green-deep)">New cohort</p>
            <input class="input mb-2" placeholder="Cohort name" [(ngModel)]="newName" />
            <input class="input mb-2" placeholder="Roadmap goal (e.g. MERN Developer)" [(ngModel)]="newGoal" />
            <textarea class="input mb-3" rows="2" placeholder="Description (optional)" [(ngModel)]="newDesc"></textarea>
            <button class="w-full inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-ink"
              style="background:var(--green)" [disabled]="!newName.trim() || creating()" (click)="create()">
              {{ creating() ? 'Creating…' : 'Create cohort' }}
            </button>
          </div>

          <div>
            <p class="kicker mb-3">Organization cohorts</p>
            @if (orgCohorts().length === 0) {
              <p class="text-sm text-txt-mute">No cohorts yet. Create one above.</p>
            }
            <div class="space-y-2 motion-row-primary">
              @for (c of orgCohorts(); track c.id; let i = $index) {
                <button class="w-full text-left card hover-lift motion-card-reveal" style="padding:12px 14px"
                  [style.--motion-card-index]="i"
                  [style.borderColor]="selected()?.id === c.id ? 'var(--green)' : null" (click)="select(c.id)">
                  <div class="flex items-center justify-between gap-2">
                    <b class="font-display">{{ c.name }}</b>
                    <span class="pill" [style.color]="statusColor(c.status)">{{ c.status }}</span>
                  </div>
                  <p class="text-xs text-txt-mute mt-1">{{ c.studentCount }} students · {{ c.mentorCount }} mentors</p>
                </button>
              }
            </div>
          </div>
        }

        <div>
          <p class="kicker mb-3">My cohorts</p>
          @if (mine().length === 0) {
            <p class="text-sm text-txt-mute">You're not in a cohort yet.</p>
          }
          <div class="space-y-2 motion-row-2">
            @for (c of mine(); track c.id; let i = $index) {
              <button class="w-full text-left card hover-lift motion-card-reveal" style="padding:12px 14px"
                [style.--motion-card-index]="i"
                [style.borderColor]="selected()?.id === c.id ? 'var(--green)' : null" (click)="select(c.id)">
                <b class="font-display">{{ c.name }}</b>
                <p class="text-xs text-txt-mute mt-1">{{ c.organizationName }} · {{ c.roadmapGoal || 'No goal set' }}</p>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Right: detail -->
      <div>
        @if (!selected()) {
          <div class="card grid place-items-center text-center" style="padding:60px 24px;min-height:300px">
            <div>
              <p class="font-display text-xl mb-1">Select a cohort</p>
              <p class="text-sm text-txt-soft">Pick a cohort to see its leaderboard, announcements and members.</p>
            </div>
          </div>
        }
        @if (selected(); as c) {
          <div class="space-y-5 motion-row-primary">
            <div class="card motion-card-reveal" style="padding:20px" [style.--motion-card-index]="0">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 class="font-display text-2xl">{{ c.name }}</h2>
                  <p class="text-sm text-txt-soft mt-1">{{ c.description || 'No description.' }}</p>
                  <div class="flex gap-2 mt-3 flex-wrap text-xs">
                    <span class="pill">{{ c.roadmapGoal || 'No goal' }}</span>
                    <span class="pill">{{ c.studentCount }} students</span>
                    <span class="pill">{{ c.mentorCount }} mentors</span>
                    <span class="pill" [style.color]="statusColor(c.status)">{{ c.status }}</span>
                  </div>
                </div>
                @if (canManage()) {
                  <select class="input" style="width:auto" [ngModel]="c.status" (ngModelChange)="setStatus($event)">
                    @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
                  </select>
                }
              </div>
            </div>

            <!-- Leaderboard (managers: everyone · peers: opt-in both ways) -->
            <div class="card motion-card-reveal" style="padding:18px" [style.--motion-card-index]="1">
              <div class="flex items-center justify-between mb-3">
                <p class="kicker !mb-0" style="color:var(--green-deep)">Leaderboard</p>
                <div class="flex items-center gap-2">
                  @if (!canManage() && peer()?.optedIn) {
                    <button class="pill" style="cursor:pointer" (click)="optIn(false)">Leave leaderboard</button>
                  }
                  @if (canManage() && leaderboard().length) {
                    <button class="pill" style="cursor:pointer" (click)="exportLeaderboard()">⬇ CSV</button>
                  }
                </div>
              </div>
              @if (!canManage() && peer() && !peer()!.optedIn) {
                <div class="text-sm text-txt-soft">
                  <p class="mb-3">The peer leaderboard is opt-in both ways — join it to see the {{ peer()!.listedCount }} member{{ peer()!.listedCount === 1 ? '' : 's' }} already on it. Joining shares your health, readiness and active-days with them.</p>
                  <button class="pill" style="cursor:pointer" (click)="optIn(true)">Join the leaderboard</button>
                </div>
              } @else if (leaderboard().length === 0) {
                <p class="text-sm text-txt-mute">{{ canManage() ? 'No students yet — add some to populate the leaderboard.' : "No one on the board yet — you're the first. 🎉" }}</p>
              }
              <div class="space-y-2.5">
                @for (r of leaderboard(); track r.userId) {
                  <div class="flex items-center gap-3 lb-row">
                    <span class="lb-rank" [class.lb-top]="r.rank <= 3" [class.lb-gold]="r.rank === 1">{{ r.rank }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between text-sm mb-1"><span class="truncate">{{ r.name }}</span><span class="font-mono text-txt-mute">{{ r.health }}%</span></div>
                      <asta-progress [value]="r.health" />
                      <div class="flex gap-3 mt-1 text-[10.5px] text-txt-mute"><span>{{ r.readiness }}% ready</span><span>{{ r.activeDays }} active day{{ r.activeDays === 1 ? '' : 's' }}</span></div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Announcements -->
            <div class="card motion-card-reveal" style="padding:18px" [style.--motion-card-index]="2">
              <p class="kicker mb-3">Announcements</p>
              @if (canManage()) {
                <div class="mb-4">
                  <input class="input mb-2" placeholder="Announcement title" [(ngModel)]="annTitle" />
                  <textarea class="input mb-2" rows="2" placeholder="Message…" [(ngModel)]="annBody"></textarea>
                  <button class="pill" style="cursor:pointer" [disabled]="!annTitle.trim()" (click)="postAnnouncement()">Post announcement</button>
                </div>
              }
              @if (c.announcements.length === 0) {
                <p class="text-sm text-txt-mute">No announcements yet.</p>
              }
              <div class="space-y-3">
                @for (a of c.announcements; track a.id) {
                  <div style="border-left:2px solid var(--green);padding-left:12px">
                    <b>{{ a.title }}</b>
                    <p class="text-sm text-txt-soft">{{ a.body }}</p>
                    <p class="text-[11px] font-mono text-txt-mute mt-0.5">{{ a.authorName }} · {{ a.createdAt | date: 'mediumDate' }}</p>
                  </div>
                }
              </div>
            </div>

            <!-- Members -->
            <div class="card motion-card-reveal" style="padding:18px" [style.--motion-card-index]="3">
              <p class="kicker mb-3">Members</p>
              <div class="grid sm:grid-cols-2 gap-4">
                <div>
                  <p class="text-xs font-mono uppercase tracking-wider text-txt-mute mb-2">Mentors</p>
                  @for (m of c.mentors; track m.userId) {
                    <div class="flex items-center justify-between text-sm py-1">
                      <span class="truncate">{{ m.name }}</span>
                      @if (canManage()) { <button class="text-txt-mute hover:text-[color:var(--danger)]" (click)="removeMember(m.userId)" [attr.aria-label]="'Remove ' + m.name">×</button> }
                    </div>
                  } @empty { <p class="text-sm text-txt-mute">None.</p> }
                </div>
                <div>
                  <p class="text-xs font-mono uppercase tracking-wider text-txt-mute mb-2">Students</p>
                  @for (m of c.students; track m.userId) {
                    <div class="flex items-center justify-between text-sm py-1">
                      <span class="truncate">{{ m.name }}</span>
                      @if (canManage()) { <button class="text-txt-mute hover:text-[color:var(--danger)]" (click)="removeMember(m.userId)" [attr.aria-label]="'Remove ' + m.name">×</button> }
                    </div>
                  } @empty { <p class="text-sm text-txt-mute">None.</p> }
                </div>
              </div>

              @if (canManage() && addableMembers().length) {
                <div class="mt-4 pt-3" style="border-top:1px solid var(--paper-3)">
                  <p class="text-xs font-mono uppercase tracking-wider text-txt-mute mb-2">Add from organization</p>
                  <div class="space-y-1.5">
                    @for (om of addableMembers(); track om.userId) {
                      <div class="flex items-center justify-between text-sm">
                        <span class="truncate">{{ om.name }} <span class="text-txt-mute">· {{ om.orgRole }}</span></span>
                        <span class="flex gap-1.5">
                          <button class="pill" style="cursor:pointer" (click)="addMember(om.userId, 'student')">+ student</button>
                          <button class="pill" style="cursor:pointer" (click)="addMember(om.userId, 'mentor')">+ mentor</button>
                        </span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
    styles: [
        `
      .lb-row { animation: astaRevealUp 0.4s var(--ease) both; }
      .lb-row:nth-child(2) { animation-delay: 0.05s; }
      .lb-row:nth-child(3) { animation-delay: 0.1s; }
      .lb-row:nth-child(4) { animation-delay: 0.15s; }
      .lb-row:nth-child(5) { animation-delay: 0.2s; }
      .lb-rank {
        width: 28px; height: 28px; flex-shrink: 0;
        display: grid; place-items: center; border-radius: 9px;
        font-family: var(--display); font-weight: 600; font-size: 14px;
        color: var(--text-mute); background: var(--paper-2);
      }
      .lb-top { color: var(--green-deep); background: color-mix(in oklch, var(--green) 14%, transparent); }
      .lb-gold {
        color: var(--ink);
        background: linear-gradient(135deg, var(--green), var(--green-deep));
        box-shadow: 0 4px 14px var(--asta-accent-glow);
      }
      @media (prefers-reduced-motion: reduce) { .lb-row { animation: none; } }
    `,
    ]
})
export class CohortsComponent implements OnInit {
  private readonly cohorts = inject(CohortService);
  private readonly orgApi = inject(OrgService);
  private readonly orgCtx = inject(OrgContextService);
  private readonly toast = inject(ToastService);

  readonly mine = signal<CohortView[]>([]);
  readonly orgCohorts = signal<CohortView[]>([]);
  readonly selected = signal<CohortDetail | null>(null);
  readonly leaderboard = signal<LeaderboardRow[]>([]);
  /** Peer view of the leaderboard (students) — null for managers. */
  readonly peer = signal<PeerLeaderboard | null>(null);
  readonly orgMembers = signal<OrgMember[]>([]);
  readonly creating = signal(false);

  readonly canManage = computed(() => this.orgCtx.has('cohort.create'));
  readonly statuses: CohortStatus[] = ['draft', 'active', 'completed', 'archived'];

  /** Org members not already in the selected cohort. */
  readonly addableMembers = computed(() => {
    const c = this.selected();
    if (!c) return [];
    const inCohort = new Set([...c.mentors, ...c.students].map((m) => m.userId));
    return this.orgMembers().filter((m) => !inCohort.has(m.userId));
  });

  newName = '';
  newGoal = '';
  newDesc = '';
  annTitle = '';
  annBody = '';

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.cohorts.mine().subscribe({ next: (c) => this.mine.set(c) });
    if (this.canManage()) {
      this.cohorts.listForOrg().subscribe({ next: (c) => this.orgCohorts.set(c) });
    }
  }

  /** Export the selected cohort's leaderboard as CSV (for cohort managers). */
  exportLeaderboard(): void {
    const rows = this.leaderboard();
    if (!rows.length) return;
    const esc = (v: unknown): string => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Rank', 'Name', 'Health %', 'Readiness %', 'Active days'];
    const body = rows.map((r) => [r.rank, r.name, r.health, r.readiness, r.activeDays]);
    const csv = [header, ...body].map((row) => row.map(esc).join(',')).join('\r\n');
    const name = (this.selected()?.name ?? 'cohort').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-leaderboard-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Leaderboard exported');
  }

  select(id: string): void {
    this.cohorts.detail(id).subscribe({ next: (d) => this.selected.set(d) });
    if (this.canManage()) {
      this.peer.set(null);
      this.cohorts.leaderboard(id).subscribe({ next: (l) => this.leaderboard.set(l) });
    } else {
      // Peers get the opt-in view: rows only once they've joined the board themselves.
      this.leaderboard.set([]);
      this.cohorts.peerLeaderboard(id).subscribe({
        next: (p) => {
          this.peer.set(p);
          this.leaderboard.set(p.rows);
        },
        error: () => this.peer.set(null),
      });
    }
    const orgId = this.orgCtx.activeOrgId();
    if (this.canManage() && orgId) {
      this.orgApi.members(orgId).subscribe({ next: (m) => this.orgMembers.set(m) });
    }
  }

  /** Join/leave the peer leaderboards, then refresh the view. */
  optIn(join: boolean): void {
    this.cohorts.setLeaderboardOptIn(join).subscribe({
      next: () => {
        this.toast.success(join ? "You're on the leaderboard now" : 'Left the leaderboard — your scores are hidden again');
        const c = this.selected();
        if (c) this.select(c.id);
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not update'),
    });
  }

  create(): void {
    if (!this.newName.trim()) return;
    this.creating.set(true);
    this.cohorts
      .create({ name: this.newName.trim(), roadmapGoal: this.newGoal.trim(), description: this.newDesc.trim() })
      .subscribe({
        next: (c) => {
          this.toast.success('Cohort created');
          this.newName = this.newGoal = this.newDesc = '';
          this.creating.set(false);
          this.orgCohorts.update((list) => [c, ...list]);
          this.select(c.id);
        },
        error: () => this.creating.set(false),
      });
  }

  setStatus(status: CohortStatus): void {
    const c = this.selected();
    if (!c) return;
    this.cohorts.update(c.id, { status }).subscribe({
      next: () => {
        this.selected.update((cur) => (cur ? { ...cur, status } : cur));
        this.orgCohorts.update((list) => list.map((x) => (x.id === c.id ? { ...x, status } : x)));
        this.toast.success('Status updated');
      },
    });
  }

  addMember(userId: string, role: 'mentor' | 'student'): void {
    const c = this.selected();
    if (!c) return;
    this.cohorts.addMembers(c.id, [userId], role).subscribe({ next: (d) => this.selected.set(d) });
  }

  removeMember(userId: string): void {
    const c = this.selected();
    if (!c) return;
    this.cohorts.removeMember(c.id, userId).subscribe({ next: (d) => this.selected.set(d) });
  }

  postAnnouncement(): void {
    const c = this.selected();
    if (!c || !this.annTitle.trim()) return;
    this.cohorts.announce(c.id, this.annTitle.trim(), this.annBody.trim()).subscribe({
      next: (d) => {
        this.selected.set(d);
        this.annTitle = this.annBody = '';
        this.toast.success('Announcement posted');
      },
    });
  }

  statusColor(status: CohortStatus): string {
    switch (status) {
      case 'active': return 'var(--green-deep)';
      case 'completed': return 'var(--peri-deep)';
      case 'archived': return 'var(--text-mute)';
      default: return 'var(--coral-deep)';
    }
  }
}
