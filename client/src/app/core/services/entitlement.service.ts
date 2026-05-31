import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  EntitlementCheck,
  EntitlementSummary,
  FeatureKey,
} from '../models';

/**
 * Entitlement gate (Phase 10 · M1). Loads the user's entitlement summary once and exposes
 * a synchronous `can(key)` for templates/guards plus an async `check()` for precise limits.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private readonly api = inject(ApiService);

  private readonly _summary = signal<EntitlementSummary | null>(null);
  readonly summary = this._summary.asReadonly();
  readonly planName = computed(() => this._summary()?.planName ?? 'Free');

  /** Fetch + cache the entitlement summary (call after login / on billing pages). */
  load(): Observable<EntitlementSummary> {
    return this.api
      .get<EntitlementSummary>('/entitlements/me')
      .pipe(tap((s) => this._summary.set(s)));
  }

  /** Synchronous best-effort check from the cached summary. Defaults to allowed when unloaded. */
  can(key: FeatureKey): boolean {
    const s = this._summary();
    if (!s) return true;
    const f = s.features.find((x) => x.featureKey === key);
    return f ? f.allowed : true;
  }

  /** Cached per-feature view (used by the entitlement gate for messaging). */
  feature(key: FeatureKey): EntitlementCheck | undefined {
    return this._summary()?.features.find((f) => f.featureKey === key);
  }

  /** Authoritative server check for one feature (used before an expensive action). */
  check(featureKey: FeatureKey, amount = 1): Observable<EntitlementCheck> {
    return this.api.post<EntitlementCheck>('/entitlements/check', {
      featureKey,
      amount,
    });
  }

  consume(featureKey: FeatureKey, amount = 1): Observable<EntitlementCheck> {
    return this.api.post<EntitlementCheck>('/entitlements/consume', {
      featureKey,
      amount,
    });
  }
}
