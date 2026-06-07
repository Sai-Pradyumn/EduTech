import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditView, OpsService } from '../../core/services/ops.service';

/** Audit log viewer (Phase 10 · M6). Role.Admin. Immutable trail of security-relevant
 *  actions with actor, target and metadata. */
@Component({
  selector: 'asta-admin-audit-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, FormsModule],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Audit logs</h1>
        <span class="goal-pill"><span class="dot"></span>who did what, when</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <div class="al-search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Search actor or target…" aria-label="Search audit logs" />
        </div>
        @if (filtered().length) {
          <button class="al-export" (click)="exportCsv()" aria-label="Export audit logs as CSV">⬇ CSV</button>
        }
      </div>
    </header>

    @if (actions().length > 1) {
      <div class="al-chips">
        <button class="al-chip" [class.on]="actionFilter() === 'all'" (click)="actionFilter.set('all')">all <span class="ct">{{ logs().length }}</span></button>
        @for (a of actions(); track a) {
          <button class="al-chip" [class.on]="actionFilter() === a" (click)="actionFilter.set(a)">{{ a }} <span class="ct">{{ actionCount(a) }}</span></button>
        }
      </div>
    }

    <div class="card" style="padding:18px">
      <div class="space-y-1">
        @for (l of filtered(); track l.id) {
          <div class="flex items-center gap-3 text-sm py-2" style="border-bottom:1px solid var(--paper-3)">
            <span class="pill font-mono">{{ l.action }}</span>
            <span class="min-w-0 flex-1 truncate">
              {{ l.actorEmail || 'system' }}
              @if (l.targetType) { <span class="text-txt-mute">· {{ l.targetType }}:{{ l.targetId }}</span> }
            </span>
            <span class="font-mono text-[11px] text-txt-mute truncate max-w-[28%]">{{ l.metadata | json }}</span>
            <span class="font-mono text-xs text-txt-mute">{{ l.createdAt | date: 'MMM d, HH:mm' }}</span>
          </div>
        } @empty {
          <p class="text-sm text-txt-mute">{{ logs().length ? 'No entries match this filter.' : 'No audit entries yet.' }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .al-search { position: relative; display: flex; align-items: center; }
    .al-search svg { position: absolute; left: 11px; color: var(--text-mute); pointer-events: none; }
    .al-search input { width: 240px; max-width: 100%; padding: 8px 12px 8px 32px; font-size: 13px; color: var(--text); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 11px; }
    .al-search input:focus { outline: none; border-color: var(--green); }
    .al-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .al-chip { font-family: var(--mono); font-size: 11px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-mute); cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
    .al-chip:hover { color: var(--text-soft); }
    .al-chip.on { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); background: color-mix(in oklab, var(--green) 12%, transparent); }
    .al-chip .ct { font-weight: 700; opacity: .7; }
    .al-export { font-size: 12.5px; padding: 8px 13px; border-radius: 11px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: pointer; transition: border-color .15s, color .15s; }
    .al-export:hover { border-color: var(--green); color: var(--green-deep); }
  `],
})
export class AdminAuditLogsComponent implements OnInit {
  private readonly ops = inject(OpsService);
  readonly logs = signal<AuditView[]>([]);
  readonly q = signal('');
  readonly actionFilter = signal<string>('all');

  readonly actions = computed(() =>
    [...new Set(this.logs().map((l) => l.action))].sort((a, b) => a.localeCompare(b)),
  );

  readonly filtered = computed(() => {
    const needle = this.q().trim().toLowerCase();
    const action = this.actionFilter();
    return this.logs().filter((l) => {
      if (action !== 'all' && l.action !== action) return false;
      if (needle) {
        const hay = `${l.actorEmail ?? ''} ${l.targetType ?? ''} ${l.targetId ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    this.ops.auditLogs().subscribe({ next: (l) => this.logs.set(l) });
  }

  actionCount(action: string): number {
    return this.logs().filter((l) => l.action === action).length;
  }

  /** Export the currently-filtered audit trail as CSV (compliance-friendly). */
  exportCsv(): void {
    const rows = this.filtered();
    if (!rows.length) return;
    const esc = (v: unknown): string => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['Time (ISO)', 'Action', 'Actor', 'Target type', 'Target id', 'Metadata'];
    const body = rows.map((l) => [
      l.createdAt ? new Date(l.createdAt).toISOString() : '',
      l.action, l.actorEmail || 'system', l.targetType ?? '', l.targetId ?? '',
      l.metadata ? JSON.stringify(l.metadata) : '',
    ]);
    const csv = [header, ...body].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
