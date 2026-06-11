import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AdminRoadmapRow } from '../../core/models';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ProgressComponent } from '../../shared/ui/progress.component';
import { DonutChartComponent, ChartDatum } from '../../shared/charts';

/**
 * `/admin/roadmaps` (B1) — read-only browser of every generated roadmap across
 * students: owner, goal, status, progress, week counts. Status-mix donut, search,
 * and loading / empty / error states (Workstream E). Role.Admin.
 */
@Component({
  selector: 'asta-admin-roadmaps',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, SkeletonComponent, EmptyStateComponent, ProgressComponent, DonutChartComponent],
  template: `
   <div class="asta-observatory">
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Roadmaps</h1>
        <span class="goal-pill"><span class="dot"></span>Every generated path across students · progress &amp; status</span>
      </div>
    </header>

    @if (loading()) {
      <div class="card" style="padding:16px">
        @for (n of [1,2,3,4,5,6]; track n) { <div class="py-2"><asta-skeleton h="16px" /></div> }
      </div>
    } @else if (error()) {
      <asta-empty-state title="Couldn't load roadmaps" [description]="error()!">
        <button class="retry" (click)="load()">Retry</button>
      </asta-empty-state>
    } @else {
      @if (all().length) {
        <div class="grid gap-4 md:grid-cols-3 mb-4 motion-row-primary">
          <div class="card stat motion-card-reveal" style="--motion-card-index:0"><span class="num">{{ all().length }}</span><span class="lbl">Roadmaps</span></div>
          <div class="card stat motion-card-reveal" style="--motion-card-index:1"><span class="num">{{ avgProgress() }}%</span><span class="lbl">Avg progress</span></div>
          <div class="card motion-card-reveal" style="padding:14px 16px;--motion-card-index:2">
            <p class="kicker mb-2" style="color:var(--green-deep)">By status</p>
            <asta-donut-chart [data]="statusMix()" [size]="92" [thickness]="14" centerLabel="total" label="Roadmaps by status" />
          </div>
        </div>
      }
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <input class="input" style="max-width:320px;flex:1 1 240px" placeholder="Search title, goal or owner…"
          [(ngModel)]="query" (ngModelChange)="q.set($event)" />
        @if (filtered().length) { <button class="retry" style="min-height:0;padding:8px 14px;font-size:12.5px" (click)="exportCsv()">⬇ CSV</button> }
      </div>
      <div class="card motion-card-reveal motion-row-2" style="padding:0;overflow:auto;--motion-card-index:0">
        <table>
          <thead><tr><th>Roadmap</th><th>Owner</th><th>Status</th><th style="min-width:160px">Progress</th><th>Weeks</th><th>Created</th></tr></thead>
          <tbody>
            @for (r of filtered(); track r.id) {
              <tr>
                <td><b class="clamp">{{ r.title }}</b><br /><span class="sub2">{{ r.goal }}</span></td>
                <td class="sub2">{{ r.owner }}</td>
                <td><span class="pill" [style.color]="statusColor(r.status)">{{ r.status }}</span></td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="flex-1"><asta-progress [value]="r.progressPercentage" /></div>
                    <span class="sub">{{ r.progressPercentage }}%</span>
                  </div>
                </td>
                <td class="sub">{{ r.completedWeeks }}/{{ r.weeks }}</td>
                <td class="sub">{{ r.createdAt ? (r.createdAt | date: 'MMM d') : '—' }}</td>
              </tr>
            } @empty { <tr><td colspan="6" class="empty">No roadmaps match.</td></tr> }
          </tbody>
        </table>
      </div>
      <p class="gen">{{ filtered().length }} of {{ all().length }} roadmaps</p>
    }
   </div>
  `,
  styles: [
    `
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); padding: 12px 14px; border-bottom: 1px solid var(--paper-3); white-space: nowrap; }
      td { padding: 11px 14px; border-bottom: 1px solid var(--paper-2); vertical-align: top; }
      tr:last-child td { border-bottom: none; }
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
export class AdminRoadmapsComponent implements OnInit {
  private readonly api = inject(AdminService);
  readonly all = signal<AdminRoadmapRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly q = signal('');
  query = '';

  readonly filtered = computed(() => {
    const needle = this.q().trim().toLowerCase();
    if (!needle) return this.all();
    return this.all().filter((r) => `${r.title} ${r.goal} ${r.owner}`.toLowerCase().includes(needle));
  });

  readonly avgProgress = computed(() => {
    const rows = this.all();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((s, r) => s + r.progressPercentage, 0) / rows.length);
  });

  readonly statusMix = computed<ChartDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const r of this.all()) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    const tone = (s: string) => (s === 'completed' ? 'green' : s === 'archived' ? 'coral' : 'peri');
    return [...counts.entries()].map(([label, value]) => ({ label, value, tone: tone(label) as ChartDatum['tone'] }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.roadmaps().subscribe({
      next: (r) => {
        this.all.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('We could not reach the server. Check your connection and retry.');
        this.loading.set(false);
      },
    });
  }

  statusColor(status: string): string {
    return status === 'completed' ? 'var(--green-deep)' : status === 'archived' ? 'var(--coral-deep)' : 'var(--peri-deep)';
  }

  /** Export the (filtered) roadmap inventory as CSV. */
  exportCsv(): void {
    const rows = this.filtered();
    if (!rows.length) return;
    const esc = (v: unknown): string => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Title', 'Goal', 'Owner', 'Status', 'Progress %', 'Completed weeks', 'Total weeks', 'Created'];
    const body = rows.map((r) => [
      r.title, r.goal, r.owner, r.status, r.progressPercentage, r.completedWeeks, r.weeks,
      r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
    ]);
    const csv = [header, ...body].map((row) => row.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-roadmaps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
