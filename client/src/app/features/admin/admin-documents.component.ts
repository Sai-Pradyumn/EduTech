import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AdminDocumentRow } from '../../core/models';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { DonutChartComponent, ChartDatum } from '../../shared/charts';

/**
 * `/admin/documents` (B1) — platform-wide knowledge document browser. Lists every
 * `knowledge_document` with owner + ingestion status, a status-mix donut, search,
 * and honest loading / empty / error states (Workstream E). Read-only; Role.Admin.
 */
@Component({
  selector: 'asta-admin-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, SkeletonComponent, EmptyStateComponent, DonutChartComponent],
  template: `
   <div class="asta-observatory">
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Documents</h1>
        <span class="goal-pill"><span class="dot"></span>Platform-wide knowledge base · ingestion status &amp; chunks</span>
      </div>
    </header>

    @if (loading()) {
      <div class="card" style="padding:16px">
        @for (n of [1,2,3,4,5,6]; track n) { <div class="py-2"><asta-skeleton h="16px" /></div> }
      </div>
    } @else if (error()) {
      <asta-empty-state title="Couldn't load documents" [description]="error()!">
        <button class="retry" (click)="load()">Retry</button>
      </asta-empty-state>
    } @else {
      @if (all().length) {
        <div class="card mb-4 motion-card-reveal motion-row-primary" style="padding:18px;--motion-card-index:0">
          <p class="kicker mb-3" style="color:var(--peri-deep)">Ingestion status</p>
          <asta-donut-chart [data]="statusMix()" centerLabel="docs" label="Documents by ingestion status" />
        </div>
      }
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <input class="input" style="max-width:320px;flex:1 1 240px" placeholder="Search title, owner or topic…"
          [(ngModel)]="query" (ngModelChange)="q.set($event)" />
        @if (filtered().length) { <button class="retry" style="min-height:0;padding:8px 14px;font-size:12.5px" (click)="exportCsv()">⬇ CSV</button> }
      </div>
      <div class="card motion-card-reveal motion-row-2" style="padding:0;overflow:auto;--motion-card-index:0">
        <table>
          <thead><tr><th>Document</th><th>Owner</th><th>Source</th><th>Status</th><th>Chunks</th><th>Tokens</th><th>Lang</th><th>Added</th></tr></thead>
          <tbody>
            @for (d of filtered(); track d.id) {
              <tr>
                <td><b class="clamp">{{ d.title }}</b></td>
                <td class="sub2">{{ d.owner }}</td>
                <td>{{ d.source }}</td>
                <td><span class="pill" [style.color]="statusColor(d.status)">{{ d.status }}</span></td>
                <td>{{ d.chunkCount }}</td>
                <td>{{ d.tokenCount }}</td>
                <td class="sub">{{ d.language }}</td>
                <td class="sub">{{ d.createdAt ? (d.createdAt | date: 'MMM d') : '—' }}</td>
              </tr>
            } @empty { <tr><td colspan="8" class="empty">No documents match.</td></tr> }
          </tbody>
        </table>
      </div>
      <p class="gen">{{ filtered().length }} of {{ all().length }} documents</p>
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
      .clamp { display: inline-block; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
      .empty { text-align: center; color: var(--text-mute); padding: 28px; }
      .gen { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 10px; }
      .retry { border-radius: 100px; padding: 9px 18px; font-weight: 600; background: var(--accent); color: var(--ink); min-height: 40px; }
    `,
  ],
})
export class AdminDocumentsComponent implements OnInit {
  private readonly api = inject(AdminService);
  readonly all = signal<AdminDocumentRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly q = signal('');
  query = '';

  readonly filtered = computed(() => {
    const needle = this.q().trim().toLowerCase();
    if (!needle) return this.all();
    return this.all().filter((d) => `${d.title} ${d.owner} ${d.source}`.toLowerCase().includes(needle));
  });

  readonly statusMix = computed<ChartDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const d of this.all()) counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    const tone = (s: string) => (s === 'ready' ? 'green' : s === 'failed' ? 'coral' : 'peri');
    return [...counts.entries()].map(([label, value]) => ({ label, value, tone: tone(label) as ChartDatum['tone'] }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.documents().subscribe({
      next: (d) => {
        this.all.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('We could not reach the server. Check your connection and retry.');
        this.loading.set(false);
      },
    });
  }

  statusColor(status: string): string {
    return status === 'ready' ? 'var(--green-deep)' : status === 'failed' ? 'var(--coral-deep)' : 'var(--peri-deep)';
  }

  /** Export the (filtered) document inventory as CSV. */
  exportCsv(): void {
    const rows = this.filtered();
    if (!rows.length) return;
    const esc = (v: unknown): string => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Title', 'Owner', 'Source', 'Status', 'Chunks', 'Tokens', 'Language', 'Added'];
    const body = rows.map((d) => [
      d.title, d.owner, d.source, d.status, d.chunkCount, d.tokenCount, d.language,
      d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : '',
    ]);
    const csv = [header, ...body].map((row) => row.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-documents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
