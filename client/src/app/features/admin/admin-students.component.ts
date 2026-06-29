import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AdminStudentRow } from '../../core/models';
import { CardComponent } from '../../shared/ui/card.component';
import { CountDirective } from '../../shared/directives/count.directive';

/**
 * Admin Command Center — students roster (A7). Every platform student with goal, skill level
 * and learning health, with a quick search. Read-only; Role.Admin. Noir cockpit pass.
 */
@Component({
    selector: 'asta-admin-students',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, FormsModule, CardComponent, CountDirective],
    template: `
   <div class="asta-observatory">
    <!-- Compact command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Students</h1>
        <span class="goal-pill"><span class="dot"></span>student intelligence</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <div class="search-wrap">
          <svg class="search-ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input class="search-input" placeholder="Search name, email or goal…" [(ngModel)]="query" (ngModelChange)="q.set($event)" aria-label="Search students" />
        </div>
        <select class="sort-select" [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)" aria-label="Sort students">
          <option value="recent">Recently active</option>
          <option value="name">Name (A–Z)</option>
          <option value="health">Lowest health</option>
          <option value="readiness">Highest readiness</option>
          <option value="quizzes">Most quizzes</option>
        </select>
        @if (filtered().length) {
          <button class="sort-select" style="cursor:pointer" (click)="exportCsv()" aria-label="Export roster as CSV">⬇ CSV</button>
        }
      </div>
    </header>

    <!-- Cohort filter chips -->
    <div class="filter-row motion-card-reveal" style="--motion-card-index:0">
      @for (f of healthChips; track f.key) {
        <button class="chip" [class.on]="healthFilter() === f.key" (click)="healthFilter.set(f.key)">
          <span class="chip-dot" [attr.data-tone]="f.key"></span>{{ f.label }}
        </button>
      }
      <span class="chip-sep"></span>
      <button class="chip" [class.on]="onboardedOnly()" (click)="onboardedOnly.set(!onboardedOnly())">Unonboarded only</button>
    </div>

    <asta-card class="motion-card-reveal motion-row-primary" style="--motion-card-index:0" [padded]="false">
      <div class="panel-head" style="padding:16px 18px 12px">
        <div class="min-w-0">
          <p class="kicker mb-1">Roster</p>
          <h2 class="t-h-card">Every learner on Asta</h2>
        </div>
        <span class="panel-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
      </div>

      <div class="roster-scroll">
        <table>
          <thead><tr><th>Student</th><th>Goal</th><th>Level</th><th>Health</th><th>Readiness</th><th>Quizzes</th><th>Last active</th></tr></thead>
          <tbody>
            @for (s of filtered(); track s.userId) {
              <tr>
                <td data-label="Student">
                  <b>{{ s.name }}</b> @if (!s.onboarded) { <span class="flag">new</span> }
                  <span class="sub">{{ s.email }}</span>
                </td>
                <td data-label="Goal" class="sub2">{{ s.goal }}</td>
                <td data-label="Level"><span class="lvl">{{ s.skillLevel }}</span></td>
                <td data-label="Health"><span class="hpill" [attr.data-tone]="healthTone(s.health)"><span class="hdot"></span><span [astaCount]="s.health"></span></span></td>
                <td data-label="Readiness"><span [astaCount]="s.readiness"></span></td>
                <td data-label="Quizzes"><span [astaCount]="s.quizzes"></span></td>
                <td data-label="Last active" class="sub">{{ s.lastActiveAt ? (s.lastActiveAt | date: 'MMM d') : 'never' }}</td>
              </tr>
            } @empty {
              @if (loaded()) {
                <tr><td colspan="7" class="empty">
                  <p class="empty-title">No students match</p>
                  <p class="empty-sub">{{ (q() || healthFilter() !== 'all' || onboardedOnly()) ? 'Try a broader search or clear the cohort filters above.' : 'Learners will appear here as they join Asta.' }}</p>
                </td></tr>
              } @else {
                @for (row of [0,1,2,3,4]; track row) {
                  <tr class="skeleton-row"><td colspan="7"><span class="sk"></span></td></tr>
                }
              }
            }
          </tbody>
        </table>
      </div>
    </asta-card>

    <p class="gen">
      <span [astaCount]="filtered().length"></span> of <span [astaCount]="all().length"></span> students
    </p>
   </div>
  `,
    styles: [
        `
      .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .panel-ico {
        width: 32px; height: 32px; flex-shrink: 0;
        display: grid; place-items: center; border-radius: 10px;
        color: var(--green-deep);
        background: color-mix(in oklch, var(--green) 13%, transparent);
        transition: transform 0.4s var(--ease-spring);
      }
      asta-card:hover .panel-ico { transform: scale(1.14) rotate(-8deg); }

      /* Search field with focus glow */
      .search-wrap { position: relative; display: flex; align-items: center; }
      .search-ico { position: absolute; left: 12px; color: var(--text-mute); pointer-events: none; transition: color 0.2s var(--ease); }
      .search-input {
        width: 280px; max-width: 100%;
        padding: 9px 14px 9px 34px;
        font-size: 13px; color: var(--text);
        background: color-mix(in oklch, var(--paper-2) 60%, transparent);
        border: 1px solid var(--paper-3); border-radius: 11px;
        transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background 0.2s var(--ease);
      }
      .search-input::placeholder { color: var(--text-mute); }
      .search-input:focus {
        outline: none;
        border-color: color-mix(in oklch, var(--green) 55%, transparent);
        background: var(--paper-2);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--green) 14%, transparent), 0 0 18px var(--asta-accent-glow);
      }
      .search-wrap:focus-within .search-ico { color: var(--green-deep); }

      /* Sort dropdown */
      .sort-select {
        padding: 9px 12px; font-size: 13px; color: var(--text-soft);
        background: color-mix(in oklch, var(--paper-2) 60%, transparent);
        border: 1px solid var(--paper-3); border-radius: 11px; cursor: pointer;
        transition: border-color 0.2s var(--ease);
      }
      .sort-select:focus { outline: none; border-color: color-mix(in oklch, var(--green) 55%, transparent); }

      /* Cohort filter chips */
      .filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 14px; }
      .chip {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; color: var(--text-soft);
        padding: 5px 12px; border-radius: 999px;
        background: color-mix(in oklch, var(--paper-2) 55%, transparent);
        border: 1px solid var(--paper-3); cursor: pointer;
        transition: color 0.18s var(--ease), border-color 0.18s var(--ease), background 0.18s var(--ease);
      }
      .chip:hover { border-color: color-mix(in oklch, var(--green) 40%, transparent); }
      .chip.on {
        color: var(--green-deep); border-color: color-mix(in oklch, var(--green) 55%, transparent);
        background: color-mix(in oklch, var(--green) 12%, transparent);
      }
      .chip-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--green); }
      .chip-dot[data-tone='all'] { background: var(--text-mute); }
      .chip-dot[data-tone='good'] { background: var(--green); }
      .chip-dot[data-tone='warn'] { background: var(--peri); }
      .chip-dot[data-tone='risk'] { background: var(--coral); }
      .chip-sep { width: 1px; height: 18px; background: var(--paper-3); margin: 0 2px; }

      .roster-scroll { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); padding: 10px 16px; border-top: 1px solid var(--paper-3); border-bottom: 1px solid var(--paper-3); background: color-mix(in oklch, var(--paper-2) 35%, transparent); }
      td { padding: 12px 16px; border-bottom: 1px solid var(--paper-2); vertical-align: middle; }
      tbody tr { transition: background 0.18s var(--ease), box-shadow 0.18s var(--ease), transform 0.18s var(--ease-spring); }
      tbody tr:hover {
        background: color-mix(in oklch, var(--green) 5%, transparent);
        box-shadow: inset 3px 0 0 var(--green);
      }
      tbody tr:last-child td { border-bottom: none; }

      td b { color: var(--text); font-weight: 600; }
      .sub { display: block; font-size: 11px; color: var(--text-mute); margin-top: 2px; }
      .sub2 { font-size: 12px; color: var(--text-soft); max-width: 220px; }
      .lvl {
        font-family: var(--mono); font-size: 11px; text-transform: capitalize;
        padding: 3px 9px; border-radius: 999px;
        color: var(--text-soft); background: color-mix(in oklch, var(--paper-3) 70%, transparent);
      }
      .flag {
        font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: .04em;
        padding: 1px 6px; border-radius: 999px; margin-left: 4px;
        background: color-mix(in oklch, var(--peri) 16%, transparent); color: var(--peri-deep);
      }

      /* Flat, subtly-glowing color-coded health pill */
      .hpill {
        display: inline-flex; align-items: center; gap: 6px;
        font-family: var(--mono); font-size: 12px; font-weight: 600;
        padding: 3px 10px; border-radius: 999px;
        color: var(--green-deep);
        background: color-mix(in oklch, var(--green) 12%, transparent);
        transition: transform 0.18s var(--ease-spring);
      }
      .hpill .hdot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; box-shadow: 0 0 8px currentColor; }
      .hpill[data-tone='warn'] { color: var(--peri-deep); background: color-mix(in oklch, var(--peri) 14%, transparent); }
      .hpill[data-tone='risk'] { color: var(--coral-deep); background: color-mix(in oklch, var(--coral) 14%, transparent); }
      tbody tr:hover .hpill { transform: scale(1.05); }

      .empty { text-align: center; padding: 40px 24px; }
      .empty-title { font-size: 14px; font-weight: 600; color: var(--text-soft); margin-bottom: 4px; }
      .empty-sub { font-size: 12px; color: var(--text-mute); }

      /* Loading skeleton rows */
      .skeleton-row td { padding: 12px 16px; }
      .sk {
        display: block; height: 18px; border-radius: 8px;
        background: linear-gradient(90deg, var(--paper-2), color-mix(in oklch, var(--paper-3) 60%, transparent), var(--paper-2));
        background-size: 200% 100%; animation: skShimmer 1.4s ease-in-out infinite;
      }
      @keyframes skShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

      .gen { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 12px; }

      /* Stacked cards on small screens */
      @media (max-width: 720px) {
        .search-input { width: 200px; }
        thead { display: none; }
        tbody tr { display: block; border: 1px solid var(--paper-2); border-radius: 12px; margin: 10px; padding: 6px 0; }
        tbody tr:hover { box-shadow: 0 0 0 1px var(--green); transform: translateY(-1px); }
        td { display: flex; justify-content: space-between; align-items: center; gap: 14px; border-bottom: 1px solid var(--paper-2); padding: 9px 14px; }
        tbody tr td:last-child { border-bottom: none; }
        td::before { content: attr(data-label); font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); }
        .sub { display: inline; }
      }
      @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
    `,
    ]
})
export class AdminStudentsComponent implements OnInit {
  private readonly api = inject(AdminService);
  readonly all = signal<AdminStudentRow[]>([]);
  readonly loaded = signal(false);
  readonly q = signal('');
  query = '';

  readonly healthFilter = signal<'all' | 'good' | 'warn' | 'risk'>('all');
  readonly onboardedOnly = signal(false);
  readonly sortBy = signal<'recent' | 'name' | 'health' | 'readiness' | 'quizzes'>('recent');

  readonly healthChips: { key: 'all' | 'good' | 'warn' | 'risk'; label: string }[] = [
    { key: 'all', label: 'All health' },
    { key: 'good', label: 'Healthy' },
    { key: 'warn', label: 'At watch' },
    { key: 'risk', label: 'At risk' },
  ];

  readonly filtered = computed(() => {
    const needle = this.q().trim().toLowerCase();
    const tone = this.healthFilter();
    const unonboarded = this.onboardedOnly();
    let rows = this.all().filter((s) => {
      if (needle && !`${s.name} ${s.email} ${s.goal}`.toLowerCase().includes(needle)) return false;
      if (tone !== 'all' && this.healthTone(s.health) !== tone) return false;
      if (unonboarded && s.onboarded) return false;
      return true;
    });
    rows = [...rows];
    switch (this.sortBy()) {
      case 'name':
        rows.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'health':
        rows.sort((a, b) => a.health - b.health);
        break;
      case 'readiness':
        rows.sort((a, b) => b.readiness - a.readiness);
        break;
      case 'quizzes':
        rows.sort((a, b) => b.quizzes - a.quizzes);
        break;
      default: // recent
        rows.sort(
          (a, b) =>
            new Date(b.lastActiveAt ?? 0).getTime() - new Date(a.lastActiveAt ?? 0).getTime(),
        );
    }
    return rows;
  });

  ngOnInit(): void {
    this.api.students().subscribe({
      next: (s) => { this.all.set(s); this.loaded.set(true); },
      error: () => this.loaded.set(true),
    });
  }

  healthTone(health: number): 'good' | 'warn' | 'risk' {
    return health >= 60 ? 'good' : health >= 40 ? 'warn' : 'risk';
  }

  /** Export the currently-filtered roster as CSV (respects search/sort/filters). */
  exportCsv(): void {
    const rows = this.filtered();
    if (!rows.length) return;
    const esc = (v: unknown): string => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Name', 'Email', 'Goal', 'Level', 'Health', 'Readiness', 'Quizzes', 'Last active', 'Onboarded'];
    const body = rows.map((s) => [
      s.name, s.email, s.goal, s.skillLevel, s.health, s.readiness, s.quizzes,
      s.lastActiveAt ? new Date(s.lastActiveAt).toISOString().slice(0, 10) : 'never',
      s.onboarded ? 'yes' : 'no',
    ]);
    const csv = [header, ...body].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asta-students-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
