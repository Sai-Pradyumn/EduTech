import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LiveSessionService } from '../../core/services/live-session.service';
import { CohortService } from '../../core/services/cohort.service';
import { OrgContextService } from '../../core/services/org-context.service';
import { ToastService } from '../../core/services/toast.service';
import { CohortView, LiveSessionStatus, SessionDetail, SessionView } from '../../core/models';

/**
 * Live session system (B4). Students see sessions for their cohorts, mark attendance and
 * read the AI recap; hosts (cohort.create) schedule sessions, start/end them, and the
 * recap (summary + key points + assignment + quiz topic) is generated from their notes.
 */
@Component({
    selector: 'asta-live-sessions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, DatePipe, RouterLink],
    template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Live Sessions</h1>
        <span class="goal-pill"><span class="dot"></span>Join live · mark attendance · read the AI recap</span>
      </div>
      <div class="shrink-0">
        <input class="ls-search" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search sessions…" aria-label="Search sessions" />
      </div>
    </header>

    <div class="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <!-- Left: create + lists -->
      <div class="space-y-5">
        @if (canManage()) {
          <div class="card" style="padding:16px">
            <p class="kicker mb-3" style="color:var(--green-deep)">Schedule a session</p>
            <input class="input mb-2" placeholder="Title (e.g. React Hooks deep-dive)" [(ngModel)]="newTitle" />
            <textarea class="input mb-2" rows="2" placeholder="Description (optional)" [(ngModel)]="newDesc"></textarea>
            <label for="ls-cohort" class="text-[11px] font-mono uppercase tracking-wider text-txt-mute">Cohort (optional)</label>
            <select id="ls-cohort" class="input mb-2 mt-1" [(ngModel)]="newCohortId">
              <option value="">— Org-wide —</option>
              @for (c of orgCohorts(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
            </select>
            <label for="ls-start" class="text-[11px] font-mono uppercase tracking-wider text-txt-mute">Start</label>
            <input id="ls-start" class="input mb-2 mt-1" type="datetime-local" [(ngModel)]="newStart" />
            <input class="input mb-2" type="number" min="10" max="480" placeholder="Duration (mins)" [(ngModel)]="newDuration" />
            <label for="ls-repeat" class="text-[11px] font-mono uppercase tracking-wider text-txt-mute">Repeat weekly</label>
            <select id="ls-repeat" class="input mb-3 mt-1" [(ngModel)]="newRepeat">
              <option [ngValue]="1">Just once</option>
              <option [ngValue]="4">4 weeks</option>
              <option [ngValue]="8">8 weeks</option>
              <option [ngValue]="12">12 weeks</option>
            </select>
            <button class="w-full inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-ink"
              style="background:var(--green)" [disabled]="!newTitle.trim() || !newStart || creating()" (click)="create()">
              {{ creating() ? 'Scheduling…' : 'Schedule session' }}
            </button>
          </div>

          <div>
            <p class="kicker mb-3">Organization sessions</p>
            @if (orgFiltered().length === 0) { <p class="text-sm text-txt-mute">{{ orgSessions().length ? 'No sessions match.' : 'No sessions scheduled.' }}</p> }
            <div class="space-y-2 motion-row-primary">
              @for (s of orgFiltered(); track s.id; let i = $index) {
                <button class="w-full text-left card hover-lift motion-card-reveal" style="padding:12px 14px"
                  [style.--motion-card-index]="i"
                  [style.borderColor]="selected()?.id === s.id ? 'var(--green)' : null" (click)="select(s.id)">
                  <div class="flex items-center justify-between gap-2">
                    <b class="font-display truncate">{{ s.title }}</b>
                    <span class="pill" [class.ls-live]="s.status === 'live'" [style.color]="statusColor(s.status)">@if (s.status === 'live') { <span class="ls-live-dot" aria-hidden="true"></span> }{{ s.status }}</span>
                  </div>
                  <p class="text-xs text-txt-mute mt-1">{{ s.scheduledStart | date: 'MMM d, h:mm a' }} · {{ s.attendeeCount }} joined</p>
                </button>
              }
            </div>
          </div>
        }

        <div>
          <p class="kicker mb-3">My sessions</p>
          @if (mineFiltered().length === 0) { <p class="text-sm text-txt-mute">{{ mine().length ? 'No sessions match.' : 'No sessions for your cohorts yet.' }}</p> }
          <div class="space-y-2 motion-row-2">
            @for (s of mineFiltered(); track s.id; let i = $index) {
              <button class="w-full text-left card hover-lift motion-card-reveal" style="padding:12px 14px"
                [style.--motion-card-index]="i"
                [style.borderColor]="selected()?.id === s.id ? 'var(--green)' : null" (click)="select(s.id)">
                <div class="flex items-center justify-between gap-2">
                  <b class="font-display truncate">{{ s.title }}</b>
                  <span class="pill" [class.ls-live]="s.status === 'live'" [style.color]="statusColor(s.status)">@if (s.status === 'live') { <span class="ls-live-dot" aria-hidden="true"></span> }{{ s.status }}</span>
                </div>
                <p class="text-xs text-txt-mute mt-1">{{ s.scheduledStart | date: 'MMM d, h:mm a' }} · {{ s.hostName }}</p>
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
              <p class="font-display text-xl mb-1">Select a session</p>
              <p class="text-sm text-txt-soft">Pick a session to join, view attendance, or read the AI recap.</p>
            </div>
          </div>
        }
        @if (selected(); as s) {
          <div class="space-y-5 motion-row-primary">
            <div class="card motion-card-reveal" style="padding:20px" [style.--motion-card-index]="0">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="font-display text-2xl">{{ s.title }}</h2>
                    <span class="pill" [style.color]="statusColor(s.status)">{{ s.status }}</span>
                  </div>
                  <p class="text-sm text-txt-soft mt-1">{{ s.description || 'No description.' }}</p>
                  <div class="flex gap-2 mt-3 flex-wrap text-xs">
                    <span class="pill">{{ s.scheduledStart | date: 'EEE, MMM d · h:mm a' }}</span>
                    <span class="pill">{{ s.durationMins }} min</span>
                    <span class="pill">host: {{ s.hostName }}</span>
                    <span class="pill">{{ s.attendeeCount }} joined</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-2 mt-4">
                @if (s.status !== 'ended' && s.status !== 'cancelled') {
                  <button class="btn-go" (click)="join(s)">{{ joinedSet().has(s.id) ? 'Rejoin room ↗' : 'Join room ↗' }}</button>
                }
                @if (s.meetingUrl) { <button class="btn-soft" (click)="copyLink(s.meetingUrl)">Copy meeting link</button> }
                @if (s.status === 'scheduled') { <button class="btn-soft" (click)="downloadIcs(s)">📅 Add to calendar</button> }
                @if (canManage()) {
                  @if (s.status === 'scheduled') { <button class="btn-soft" (click)="start(s.id)">Start session</button> }
                  @if (s.status === 'live') { <button class="btn-soft" (click)="showEnd.set(!showEnd())">End & recap</button> }
                  <button class="btn-soft danger" (click)="removeSession(s.id)">Delete</button>
                }
              </div>

              @if (canManage() && s.status === 'live' && showEnd()) {
                <div class="mt-4 pt-3" style="border-top:1px solid var(--paper-3)">
                  <p class="text-[11px] font-mono uppercase tracking-wider text-txt-mute mb-2">Session notes — the AI recap is generated from these</p>
                  <textarea class="input mb-2" rows="4" placeholder="What did you cover? One point per sentence works best…" [(ngModel)]="endNotes"></textarea>
                  <button class="btn-go" [disabled]="ending()" (click)="end(s.id)">{{ ending() ? 'Generating recap…' : 'End & generate recap' }}</button>
                </div>
              }
            </div>

            <!-- AI recap -->
            @if (s.recap; as r) {
              <div class="card card-accent motion-card-reveal" style="padding:18px;--accent-c:var(--peri)" [style.--motion-card-index]="1">
                <p class="kicker mb-2" style="color:var(--peri-deep)">AI recap</p>
                <p class="text-sm text-txt-soft mb-3">{{ r.summary }}</p>
                @if (r.keyPoints.length) {
                  <p class="text-[12px] text-txt-mute mb-1">Key points</p>
                  <ul class="text-sm text-txt-soft mb-3 space-y-0.5">@for (k of r.keyPoints; track k) { <li class="flex gap-2"><span style="color:var(--peri-deep)">•</span>{{ k }}</li> }</ul>
                }
                <div class="rounded-xl p-3 mb-3" style="background:var(--paper-2)">
                  <p class="text-[12px] font-semibold mb-0.5">📌 {{ r.assignmentTitle }}</p>
                  <p class="text-sm text-txt-soft">{{ r.assignmentDescription }}</p>
                </div>
                <a class="btn-soft inline-block" routerLink="/app/quizzes">Quiz yourself on “{{ r.suggestedQuizTopic }}” →</a>
              </div>
            }

            <!-- Attendance -->
            <div class="card motion-card-reveal" style="padding:18px" [style.--motion-card-index]="2">
              <p class="kicker mb-3">Attendance ({{ s.attendees.length }})</p>
              @if (s.attendees.length === 0) { <p class="text-sm text-txt-mute">No one has joined yet.</p> }
              <div class="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                @for (a of s.attendees; track a.userId) {
                  <div class="flex items-center justify-between text-sm">
                    <span class="truncate">{{ a.name }}</span>
                    <span class="text-[11px] font-mono text-txt-mute">{{ a.joinedAt | date: 'h:mm a' }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
    styles: [
        `
      .btn-go { display: inline-flex; align-items: center; gap: 6px; border-radius: 100px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--green); }
      .btn-go:disabled { opacity: .6; }
      .btn-soft { border-radius: 100px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--text-soft); background: var(--paper-2); border: 1px solid var(--paper-3); }
      .btn-soft:hover { border-color: var(--green); color: var(--green-deep); }
      .btn-soft.danger:hover { border-color: var(--coral-deep); color: var(--coral-deep); }
      .ls-search { width: 220px; max-width: 100%; padding: 8px 12px; font-size: 13px; color: var(--text); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 11px; }
      /* A live session announces itself: red-tinted pill + pulsing on-air dot. */
      .ls-live { border-color: color-mix(in oklch, var(--danger) 45%, var(--paper-3)); background: color-mix(in oklch, var(--danger) 9%, transparent); }
      .ls-live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--danger); display: inline-block; animation: lsOnAir 1.4s ease-in-out infinite; }
      @keyframes lsOnAir { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 color-mix(in oklch, var(--danger) 45%, transparent); } 50% { opacity: .6; box-shadow: 0 0 0 5px transparent; } }
      @media (prefers-reduced-motion: reduce) { .ls-live-dot { animation: none; } }
      .ls-search:focus { outline: none; border-color: var(--green); }
    `,
    ]
})
export class LiveSessionsComponent implements OnInit {
  private readonly api = inject(LiveSessionService);
  private readonly cohorts = inject(CohortService);
  private readonly orgCtx = inject(OrgContextService);
  private readonly toast = inject(ToastService);

  readonly mine = signal<SessionView[]>([]);
  readonly orgSessions = signal<SessionView[]>([]);
  readonly orgCohorts = signal<CohortView[]>([]);
  readonly query = signal('');

  private match(list: SessionView[]): SessionView[] {
    const n = this.query().trim().toLowerCase();
    if (!n) return list;
    return list.filter((s) => `${s.title} ${s.hostName} ${s.status}`.toLowerCase().includes(n));
  }
  readonly orgFiltered = computed(() => this.match(this.orgSessions()));
  readonly mineFiltered = computed(() => this.match(this.mine()));
  readonly selected = signal<SessionDetail | null>(null);
  readonly joinedSet = signal<Set<string>>(new Set());
  readonly creating = signal(false);
  readonly ending = signal(false);
  readonly showEnd = signal(false);

  readonly canManage = computed(() => this.orgCtx.has('cohort.create'));

  newTitle = '';
  newDesc = '';
  newCohortId = '';
  newStart = '';
  newDuration: number | null = 60;
  /** Weekly occurrences to create up front (1 = just this one). */
  newRepeat = 1;
  endNotes = '';

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.mine().subscribe({ next: (s) => this.mine.set(s) });
    if (this.canManage()) {
      this.api.listForOrg().subscribe({ next: (s) => this.orgSessions.set(s) });
      this.cohorts.listForOrg().subscribe({ next: (c) => this.orgCohorts.set(c) });
    }
  }

  select(id: string): void {
    this.showEnd.set(false);
    this.api.detail(id).subscribe({ next: (d) => this.selected.set(d) });
  }

  create(): void {
    if (!this.newTitle.trim() || !this.newStart) return;
    this.creating.set(true);
    this.api
      .create({
        title: this.newTitle.trim(),
        description: this.newDesc.trim() || undefined,
        cohortId: this.newCohortId || undefined,
        scheduledStart: new Date(this.newStart).toISOString(),
        durationMins: this.newDuration ?? 60,
        repeatWeeks: this.newRepeat > 1 ? this.newRepeat : undefined,
      })
      .subscribe({
        next: (d) => {
          this.creating.set(false);
          const repeated = this.newRepeat > 1;
          this.newTitle = this.newDesc = this.newCohortId = this.newStart = '';
          this.newDuration = 60;
          this.newRepeat = 1;
          this.toast.success(repeated ? 'Weekly series scheduled' : 'Session scheduled');
          if (repeated) this.load(); // series = several new sessions; refetch the list
          else this.orgSessions.update((list) => [this.toView(d), ...list]);
          this.selected.set(d);
        },
        error: (e) => {
          this.creating.set(false);
          this.toast.error(e?.message ?? 'Could not schedule');
        },
      });
  }

  start(id: string): void {
    this.api.start(id).subscribe({ next: (d) => this.applyUpdate(d) });
  }

  end(id: string): void {
    this.ending.set(true);
    this.api.end(id, this.endNotes).subscribe({
      next: (d) => {
        this.ending.set(false);
        this.showEnd.set(false);
        this.endNotes = '';
        this.applyUpdate(d);
        this.toast.success('Recap generated');
      },
      error: () => this.ending.set(false),
    });
  }

  join(s: SessionView): void {
    this.api.join(s.id).subscribe({
      next: (d) => {
        this.joinedSet.update((set) => new Set(set).add(s.id));
        this.applyUpdate(d);
        if (s.meetingUrl) window.open(s.meetingUrl, '_blank', 'noopener');
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not join'),
    });
  }

  copyLink(url: string): void {
    navigator.clipboard?.writeText(url).then(
      () => this.toast.success('Meeting link copied'),
      () => this.toast.error('Copy failed'),
    );
  }

  /** Standard .ics download so the session lands in any calendar app. */
  downloadIcs(s: SessionView): void {
    const toStamp = (d: Date): string =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const start = new Date(s.scheduledStart);
    const end = new Date(start.getTime() + (s.durationMins || 60) * 60_000);
    const esc = (t: string): string =>
      t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Asta//Live Sessions//EN',
      'BEGIN:VEVENT',
      `UID:asta-session-${s.id}`,
      `DTSTAMP:${toStamp(new Date())}`,
      `DTSTART:${toStamp(start)}`,
      `DTEND:${toStamp(end)}`,
      `SUMMARY:${esc(s.title)}`,
      `DESCRIPTION:${esc(`${s.description || 'Asta live session'}${s.meetingUrl ? `\nJoin: ${s.meetingUrl}` : ''}`)}`,
      ...(s.meetingUrl ? [`URL:${s.meetingUrl}`] : []),
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(s.title)} starts in 15 minutes`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast.success('Calendar file downloaded');
  }

  removeSession(id: string): void {
    this.api.remove(id).subscribe({
      next: () => {
        this.toast.success('Session deleted');
        if (this.selected()?.id === id) this.selected.set(null);
        this.orgSessions.update((list) => list.filter((x) => x.id !== id));
        this.mine.update((list) => list.filter((x) => x.id !== id));
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not delete'),
    });
  }

  private applyUpdate(d: SessionDetail): void {
    this.selected.set(d);
    const v = this.toView(d);
    const patch = (list: SessionView[]) => list.map((x) => (x.id === d.id ? v : x));
    this.orgSessions.update(patch);
    this.mine.update(patch);
  }

  private toView(d: SessionDetail): SessionView {
    return {
      id: d.id,
      organizationId: d.organizationId,
      cohortId: d.cohortId,
      title: d.title,
      description: d.description,
      hostId: d.hostId,
      hostName: d.hostName,
      scheduledStart: d.scheduledStart,
      durationMins: d.durationMins,
      status: d.status,
      meetingUrl: d.meetingUrl,
      attendeeCount: d.attendeeCount,
    };
  }

  statusColor(status: LiveSessionStatus): string {
    switch (status) {
      case 'live': return 'var(--coral-deep)';
      case 'ended': return 'var(--peri-deep)';
      case 'cancelled': return 'var(--text-mute)';
      default: return 'var(--green-deep)';
    }
  }
}
