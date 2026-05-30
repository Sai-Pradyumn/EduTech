import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Plan, PlanId, SubscriptionView, TransactionView, UsageView } from '../models';

/** Billing & metering API (B5/B6). */
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
  checkout(planId: PlanId): Observable<{ subscription: SubscriptionView; transaction: TransactionView }> {
    return this.api.post('/billing/checkout', { planId });
  }
}
