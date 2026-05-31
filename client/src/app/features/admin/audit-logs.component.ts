import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { AuditView, OpsService } from '../../core/services/ops.service';

/** Audit log viewer (Phase 10 · M6). Role.Admin. Immutable trail of security-relevant
 *  actions with actor, target and metadata. */
@Component({
  selector: 'asta-admin-audit-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Audit logs</h1>
        <span class="goal-pill"><span class="dot"></span>who did what, when</span>
      </div>
    </header>

    <div class="card" style="padding:18px">
      <div class="space-y-1">
        @for (l of logs(); track l.id) {
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
          <p class="text-sm text-txt-mute">No audit entries yet.</p>
        }
      </div>
    </div>
  `,
})
export class AdminAuditLogsComponent implements OnInit {
  private readonly ops = inject(OpsService);
  readonly logs = signal<AuditView[]>([]);

  ngOnInit(): void {
    this.ops.auditLogs().subscribe({ next: (l) => this.logs.set(l) });
  }
}
