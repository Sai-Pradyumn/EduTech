import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AdminBillingOverview,
  Plan,
  PlanId,
  SubscriptionView,
  TransactionView,
  UsageView,
} from '../models';

/** Billing & metering API (B5/B6 → Phase 10 · M1). */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly api = inject(ApiService);

  plans(): Observable<Plan[]> {
    return this.api.get<Plan[]>('/billing/plans');
  }
  subscription(): Observable<SubscriptionView> {
    return this.api.get<SubscriptionView>('/billing/subscription');
  }
  usage(): Observable<UsageView> {
    return this.api.get<UsageView>('/billing/usage');
  }
  transactions(): Observable<TransactionView[]> {
    return this.api.get<TransactionView[]>('/billing/transactions');
  }
  invoices(): Observable<TransactionView[]> {
    return this.api.get<TransactionView[]>('/billing/invoices');
  }
  checkout(
    planId: PlanId,
  ): Observable<{ subscription: SubscriptionView; transaction: TransactionView }> {
    return this.api.post('/billing/checkout', { planId });
  }
  changePlan(planId: PlanId): Observable<SubscriptionView> {
    return this.api.post<SubscriptionView>('/billing/change-plan', { planId });
  }
  cancel(): Observable<SubscriptionView> {
    return this.api.post<SubscriptionView>('/billing/cancel', {});
  }

  // ── admin ──
  adminOverview(): Observable<AdminBillingOverview> {
    return this.api.get<AdminBillingOverview>('/billing/admin/overview');
  }
  adminAccounts(): Observable<
    {
      userId: string;
      name: string;
      email: string;
      planId: string;
      status: string;
      provider: string;
      currentPeriodEnd: string | null;
    }[]
  > {
    return this.api.get('/billing/admin/accounts');
  }
}
