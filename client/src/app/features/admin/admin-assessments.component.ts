import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AdminQuizRow } from '../../core/models';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { BarChartComponent, ChartDatum } from '../../shared/charts';

/**
 * `/admin/assessments` (B1) — read-only browser of every generated quiz across
 * students: owner, topic, difficulty, question count + attempt stats. Difficulty
 * distribution bar, search, loading / empty / error states (E). Role.Admin.
 */
@Component({
  selector: 'asta-admin-assessments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, SkeletonComponent, EmptyStateComponent, BarChartComponent],
  template: `
   <div class="asta-observatory">
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Assessments</h1>
        <span class="goal-pill"><span class="dot"></span>Every generated quiz across students · difficulty &amp; attempts</span>
      </div>
    </header>

    @if (loading()) {
      <div class="card" style="padding:16px">
        @for (n of [1,2,3,4,5,6]; track n) { <div class="py-2"><asta-skeleton h="16px" /></div> }
      </div>
    } @else if (error()) {
      <asta-empty-state title="Couldn't load assessments" [description]="error()!">
        <button class="retry" (click)="load()">Retry</button>
      </asta-empty-state>
    } @else {
      @if (all().length) {
        <div class="grid gap-4 md:grid-cols-3 mb-4 motion-row-primary">
          <div class="card stat motion-card-reveal" style="--motion-card-index:0"><span class="num">{{ all().length }}</span><span class="lbl">Quizzes</span></div>
          <div class="card stat motion-card-reveal" style="--motion-card-index:1"><span class="num">{{ totalAttempts() }}</span><span class="lbl">Total attempts</span></div>
          <div class="card motion-card-reveal" style="padding:14px 16px;--motion-card-index:2">
            <p class="kicker mb-2">By difficulty</p>
            <asta-bar-chart tone="peri" [data]="difficultyMix()" [height]="96" label="Quizzes by difficulty" />
          </div>
        </div>
      }
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <input class="input" style="max-width:320px;flex:1 1 240px" placeholder="Search title, topic or owner…"
          [(ngModel)]="query" (ngModelChange)="q.set($event)" />
        @if (filtered().length) { <button class="retry" style="min-height:0;padding:8px 14px;font-size:12.5px" (click)="exportCsv()">⬇ CSV</button> }
      </div>
      <div class="card motion-card-reveal motion-row-2" style="padding:0;overflow:auto;--motion-card-index:0">
        <table>
          <thead><tr><th>Quiz</th><th>Owner</th><th>Topic</th><th>Difficulty</th><th>Source</th><th>Qs</th><th>Attempts</th><th>Best</th><th>Created</th></tr></thead>
          <tbody>
            @for (a of filtered(); track a.id) {
              <tr>
                <td><b class="clamp">{{ a.title }}</b></td>
                <td class="sub2">{{ a.owner }}</td>
                <td class="sub2">{{ a.topic }}</td>
                <td><span class="pill" [style.color]="diffColor(a.difficulty)">{{ a.difficulty }}</span></td>
                <td class="sub">{{ a.source }}</td>
                <td>{{ a.questionCount }}</td>
                <td>{{ a.attemptCount }}</td>
                <td>{{ a.bestScore !== null ? a.bestScore + '%' : '—' }}</td>
                <td class="sub">{{ a.createdAt ? (a.createdAt | date: 'MMM d') : '—' }}</td>
              </tr>
            } @empty { <tr><td colspan="9" class="empty">No quizzes match.</td></tr> }
          </tbody>
        </table>
      </div>
      <p class="gen">{{ filtered().length }} of {{ all().length }} quizzes</p>
    }
   </div>
  `,
  styles: [
    `
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); padding: 12px 14px; border-bottom: 1px solid var(--paper-3); white-space: nowrap; }
      td { padding: 11px 14px; border-bottom: 1px solid var(--paper-2); vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      tbody tr { transition: background .15s var(--ease); }
      tbody tr:hover { background: color-mix(in oklch, var(--green) 5%, transparent); }
      .sub { font-size: 11px; color: var(--text-mute); white-space: nowrap; }
      .sub2 { font-size: 12px; color: var(--text-soft); }
      .clamp { display: inline-block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
      .empty { text-align: center; color: var(--text-mute); padding: 28px; }
      .gen { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 10px; }
      .stat { padding: 16px; display: flex; flex-direction: column; gap: 2px; }
      .num { font-family: var(--display); font-size: 28px; line-height: 1; }
      .lbl { font-size: 10px; font-family: var(--mono); text-transform: uppercase; color: var(--text-mute); }
      .retry { border-radius: 100px; padding: 9px 18px; font-weight: 600; background: var(--accent); color: var(--ink); min-height: 40px; }
    `,
  ],
})
export class AdminAssessmentsComponent implements OnInit {
  private readonly api = inject(AdminService);
  readonly all = signal<AdminQuizRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly q = signal('');
  query = '';

  readonly filtered = computed(() => {
    const needle = this.q().trim().toLowerCase();
    if (!needle) return this.all();
    return this.all().filter((a) => `${a.title} ${a.topic} ${a.owner}`.toLowerCase().includes(needle));
  });

  readonly totalAttempts = computed(() => this.all().reduce((s, a) => s + a.attemptCount, 0));

  readonly difficultyMix = computed<ChartDatum[]>(() => {
    const order = ['beginner', 'intermediate', 'advanced'];
    const counts = new Map<string, number>();
    for (const a of this.all()) counts.set(a.difficulty, (counts.get(a.difficulty) ?? 0) + 1);
    const entries = [...counts.entries()].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0]));
    return entries.map(([label, value]) => ({ label, value }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.assessments().subscribe({
      next: (a) => {
        this.all.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('We could not reach the server. Check your connection and retry.');
        this.loading.set(false);
      },
    });
  }

  diffColor(d: string): string {
    return d === 'advanced' ? 'var(--coral-deep)' : d === 'intermediate' ? 'var(--peri-deep)' : 'var(--green-deep)';
  }

  /** Export the (filtered) quiz inventory as CSV. */
  exportCsv(): void {
    const rows = this.filtered();
    if (!rows.length) return;
    const esc = (v: unknown): string => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Title', 'Owner', 'Topic', 'Difficulty', 'Source', 'Questions', 'Attempts', 'Best score', 'Created'];
    const body = rows.map((a) => [
      a.title, a.owner, a.topic, a.difficulty, a.source, a.questionCount, a.attemptCount,
      a.bestScore != null ? a.bestScore : '', a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '',
    ]);
    const csv = [header, ...body].map((row) => row.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-assessments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
