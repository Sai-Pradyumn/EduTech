import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BillingService } from '../../core/services/billing.service';
import { AdminBillingOverview } from '../../core/models';

interface AccountRow {
  userId: string;
  name: string;
  email: string;
  planId: string;
  status: string;
  provider: string;
  currentPeriodEnd: string | null;
}

/**
 * Admin billing overview (Phase 10 · M1). Role.Admin. Plan distribution, MRR estimate and
 * the account roster. Read-only; mock-mode figures until a live provider is configured.
 */
@Component({
  selector: 'asta-admin-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Billing overview</h1>
        <span class="goal-pill"><span class="dot"></span>subscriptions, MRR &amp; accounts</span>
      </div>
    </header>

    @if (overview(); as o) {
      <div class="grid gap-3 sm:grid-cols-4 mb-5">
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.totalAccounts }}</p><p class="t-label mt-1">Accounts</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.paidAccounts }}</p><p class="t-label mt-1">Paid</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl" style="color:var(--green-deep)">₹{{ o.mrrInr }}</p><p class="t-label mt-1">Est. MRR</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.paidTransactions }}</p><p class="t-label mt-1">Paid invoices</p></div>
      </div>

      <div class="card mb-5" style="padding:18px">
        <p class="kicker mb-3">Plan distribution</p>
        <div class="space-y-2.5">
          @for (p of o.byPlan; track p.planId) {
            <div>
              <div class="flex items-center justify-between text-sm mb-1">
                <span>{{ p.name }} <span class="text-txt-mute font-mono text-xs">₹{{ p.priceInr }}/mo</span></span>
                <span class="font-mono text-txt-mute">{{ p.count }}</span>
              </div>
              <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--paper-3)">
                <div class="h-full rounded-full" style="background:var(--green)"
                  [style.width.%]="o.totalAccounts ? (p.count / o.totalAccounts) * 100 : 0"></div>
              </div>
            </div>
          }
        </div>
      </div>
    } @else {
      <span class="skel" style="display:block;width:100%;height:120px;border-radius:12px"></span>
    }

    <div class="card" style="padding:18px">
      <p class="kicker mb-3">Accounts</p>
      <div class="space-y-1">
        @for (a of accounts(); track a.userId) {
          <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
            <span class="min-w-0 flex-1 truncate">{{ a.name }} <span class="text-txt-mute">· {{ a.email }}</span></span>
            <span class="pill capitalize">{{ a.planId }}</span>
            <span class="pill" [style.color]="a.status === 'active' ? 'var(--green-deep)' : 'var(--text-mute)'">{{ a.status }}</span>
            <span class="font-mono text-xs text-txt-mute w-24 text-right">{{ a.currentPeriodEnd ? (a.currentPeriodEnd | date: 'MMM d') : '—' }}</span>
          </div>
        } @empty {
          <p class="text-sm text-txt-mute">No accounts yet.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `.skel{background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%);background-size:200% 100%;animation:s 1.4s ease infinite}@keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.skel{animation:none}}`,
  ],
})
export class AdminBillingComponent implements OnInit {
  private readonly billing = inject(BillingService);

  readonly overview = signal<AdminBillingOverview | null>(null);
  readonly accounts = signal<AccountRow[]>([]);

  ngOnInit(): void {
    this.billing.adminOverview().subscribe({ next: (o) => this.overview.set(o) });
    this.billing.adminAccounts().subscribe({ next: (a) => this.accounts.set(a) });
  }
}
