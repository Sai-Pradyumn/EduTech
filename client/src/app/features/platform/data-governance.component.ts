import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataJobView, EnterpriseService } from '../../core/services/enterprise.service';
import { ToastService } from '../../core/services/toast.service';

/** Personal data controls (Phase 10 · M14). Export your data + request account deletion;
 *  jobs are tracked with status. */
@Component({
  selector: 'asta-data-governance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Your data</h1>
        <span class="goal-pill"><span class="dot"></span>export &amp; deletion</span>
      </div>
    </header>

    <div class="max-w-app mx-auto space-y-5">
      <div class="grid gap-5 md:grid-cols-2">
        <div class="card" style="padding:18px">
          <p class="kicker mb-2">Export my data</p>
          <p class="text-sm text-txt-soft mb-3">Download a machine-readable copy of your account: profile, roadmaps, progress, proofs.</p>
          <button class="rounded-full px-4 py-2 text-sm font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="exportMe()">
            Request export
          </button>
        </div>
        <div class="card" style="padding:18px">
          <p class="kicker mb-2">Delete my account</p>
          <p class="text-sm text-txt-soft mb-3">Submit a deletion request. We confirm and process it within the retention window; this can’t be undone.</p>
          <button class="rounded-full px-4 py-2 text-sm font-semibold" style="background:var(--paper-2);color:var(--danger)" [disabled]="busy()" (click)="requestDeletion()">
            Request deletion
          </button>
        </div>
      </div>

      <div class="card" style="padding:18px">
        <p class="kicker mb-3">Requests</p>
        @if (jobs().length) {
          <div class="space-y-1">
            @for (j of jobs(); track j.id) {
              <div class="flex items-center gap-3 text-sm py-2" style="border-bottom:1px solid var(--paper-3)">
                <span class="pill capitalize">{{ j.kind === 'delete_request' ? 'deletion' : 'export' }}</span>
                <span class="pill" [style.color]="j.status === 'ready' || j.status === 'completed' ? 'var(--green-deep)' : 'var(--text-mute)'">{{ j.status }}</span>
                @if (j.note) { <span class="min-w-0 flex-1 truncate text-xs text-txt-mute" [title]="j.note">{{ j.note }}</span> }
                @else { <span class="min-w-0 flex-1"></span> }
                @if (expiresHint(j); as hint) {
                  <span class="text-[11px] font-mono" [style.color]="hint.soon ? 'var(--danger)' : 'var(--text-mute)'">{{ hint.label }}</span>
                }
                @if (j.kind === 'export' && j.fileUrl && j.status === 'ready') {
                  <a class="text-xs font-semibold" style="color:var(--green-deep)" [href]="apiUrl(j.fileUrl)" target="_blank" rel="noopener">Download</a>
                }
                <span class="font-mono text-xs text-txt-mute">{{ j.createdAt | date: 'MMM d, HH:mm' }}</span>
              </div>
            }
          </div>
        } @else {
          <p class="text-sm text-txt-mute">No requests yet.</p>
        }
      </div>
    </div>
  `,
})
export class DataGovernanceComponent implements OnInit {
  private readonly enterprise = inject(EnterpriseService);
  private readonly toast = inject(ToastService);

  readonly jobs = signal<DataJobView[]>([]);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.enterprise.dataJobs().subscribe({ next: (j) => this.jobs.set(j) });
  }

  apiUrl(path: string): string {
    return path.replace(/^\/api/, '/api');
  }

  /** Relative expiry for export/deletion jobs that carry an expiresAt. */
  expiresHint(j: DataJobView): { label: string; soon: boolean } | null {
    if (!j.expiresAt) return null;
    const ms = new Date(j.expiresAt).getTime() - Date.now();
    if (ms <= 0) return { label: 'expired', soon: true };
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return { label: `expires in ${days}d`, soon: days <= 2 };
    const hours = Math.max(1, Math.floor(ms / 3600000));
    return { label: `expires in ${hours}h`, soon: true };
  }

  exportMe(): void {
    this.busy.set(true);
    this.enterprise.exportMe().subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Export ready');
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  requestDeletion(): void {
    this.busy.set(true);
    this.enterprise.requestDeletion().subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.info('Deletion request submitted');
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }
}
