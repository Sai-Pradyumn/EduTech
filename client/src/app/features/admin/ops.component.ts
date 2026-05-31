import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ErrorView, JobView, OpsHealth, OpsService } from '../../core/services/ops.service';
import { ToastService } from '../../core/services/toast.service';

/** Ops Command Center (Phase 10 · M7). Role.Admin. System health, job ledger (retry failed)
 *  and the persisted error feed with request/error IDs. */
@Component({
  selector: 'asta-admin-ops',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Ops Command Center</h1>
        <span class="goal-pill"><span class="dot"></span>health · jobs · errors</span>
      </div>
    </header>

    @if (health(); as h) {
      <div class="grid gap-3 sm:grid-cols-4 mb-5">
        <div class="card" style="padding:16px">
          <p class="font-display text-2xl" [style.color]="h.status === 'ok' ? 'var(--green-deep)' : 'var(--danger)'">{{ h.status }}</p>
          <p class="t-label mt-1">API · {{ h.version }} · {{ h.commit }}</p>
        </div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ uptimeH(h.uptimeSec) }}</p><p class="t-label mt-1">Uptime</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ h.memory.heapUsedMb }}MB</p><p class="t-label mt-1">Heap used / {{ h.memory.rssMb }}MB rss</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl" [style.color]="(h.errors24h || 0) > 0 ? 'var(--danger)' : 'var(--green-deep)'">{{ h.errors24h || 0 }}</p><p class="t-label mt-1">Errors 24h · {{ h.jobsFailed || 0 }} jobs failed</p></div>
      </div>

      <div class="card mb-5" style="padding:14px 18px">
        <p class="kicker mb-2">Dependencies</p>
        <div class="flex flex-wrap gap-2">
          @for (c of depList(h); track c.key) {
            <span class="pill" [style.color]="c.up ? 'var(--green-deep)' : 'var(--text-mute)'">{{ c.key }}: {{ c.label }}</span>
          }
        </div>
      </div>
    }

    <!-- Jobs -->
    <div class="card mb-5" style="padding:18px">
      <div class="flex items-center justify-between mb-3">
        <p class="kicker">Background jobs</p>
        @if (jobCounts(); as c) {
          <div class="flex gap-2 text-xs font-mono">
            <span class="pill">waiting {{ c['waiting'] || 0 }}</span>
            <span class="pill">active {{ c['active'] || 0 }}</span>
            <span class="pill" style="color:var(--green-deep)">done {{ c['completed'] || 0 }}</span>
            <span class="pill" style="color:var(--danger)">failed {{ c['failed'] || 0 }}</span>
          </div>
        }
      </div>
      <div class="space-y-1">
        @for (j of jobs(); track j.id) {
          <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
            <span class="min-w-0 flex-1 truncate">{{ j.name }} <span class="text-txt-mute font-mono text-xs">{{ j.queue }}</span></span>
            <span class="pill" [style.color]="j.status === 'failed' ? 'var(--danger)' : (j.status === 'completed' ? 'var(--green-deep)' : 'var(--text-mute)')">{{ j.status }}</span>
            <span class="font-mono text-xs text-txt-mute">{{ j.attempts }}/{{ j.maxAttempts }}</span>
            @if (j.status === 'failed') {
              <button class="text-xs font-semibold" style="color:var(--green-deep)" [disabled]="busy() === j.id" (click)="retry(j)">Retry</button>
            }
          </div>
        } @empty { <p class="text-sm text-txt-mute">No jobs recorded.</p> }
      </div>
    </div>

    <!-- Errors -->
    <div class="card" style="padding:18px">
      <p class="kicker mb-3">Recent errors</p>
      <div class="space-y-1">
        @for (e of errors(); track e.errorId) {
          <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
            <span class="pill" style="color:var(--danger)">{{ e.status }}</span>
            <span class="min-w-0 flex-1 truncate">{{ e.message }} <span class="text-txt-mute font-mono text-xs">{{ e.method }} {{ e.route }}</span></span>
            <span class="font-mono text-[10px] text-txt-mute" [title]="'errorId ' + e.errorId">{{ e.errorId.slice(0, 8) }}</span>
            <span class="font-mono text-xs text-txt-mute">{{ e.createdAt | date: 'MMM d, HH:mm' }}</span>
          </div>
        } @empty { <p class="text-sm text-txt-mute">No errors recorded — clean run.</p> }
      </div>
    </div>
  `,
  styles: [],
})
export class AdminOpsComponent implements OnInit {
  private readonly ops = inject(OpsService);
  private readonly toast = inject(ToastService);

  readonly health = signal<OpsHealth | null>(null);
  readonly jobs = signal<JobView[]>([]);
  readonly jobCounts = signal<Record<string, number> | null>(null);
  readonly errors = signal<ErrorView[]>([]);
  readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.ops.metrics().subscribe({ next: (h) => this.health.set(h) });
    this.ops.jobs().subscribe({
      next: (j) => {
        this.jobs.set(j.recent);
        this.jobCounts.set(j.counts);
      },
    });
    this.ops.errors().subscribe({ next: (e) => this.errors.set(e) });
  }

  retry(j: JobView): void {
    this.busy.set(j.id);
    this.ops.retryJob(j.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Retried ${j.name}`);
        this.load();
      },
      error: () => this.busy.set(null),
    });
  }

  uptimeH(sec: number): string {
    if (sec < 3600) return `${Math.round(sec / 60)}m`;
    return `${(sec / 3600).toFixed(1)}h`;
  }

  depList(h: OpsHealth): { key: string; label: string; up: boolean }[] {
    return Object.entries(h.checks).map(([key, v]) => ({
      key,
      label: v.state ?? v.status,
      up: v.status === 'up' || v.status === 'configured' || v.status === 'ok',
    }));
  }
}
