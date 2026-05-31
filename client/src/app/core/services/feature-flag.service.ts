import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { FeatureFlagView } from '../models';

/**
 * Feature flags (Phase 10 · M16). Loads the public flag map once; the shell reads `isOn()`
 * to gate routes/cards. Admin screens use list()/set() to flip flags at runtime.
 */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private readonly api = inject(ApiService);
  private readonly _flags = signal<Record<string, boolean>>({});
  readonly flags = this._flags.asReadonly();

  load(): Observable<Record<string, boolean>> {
    return this.api
      .get<Record<string, boolean>>('/feature-flags')
      .pipe(tap((m) => this._flags.set(m)));
  }

  /** Default to enabled when the map hasn't loaded, so features never blink off on boot. */
  isOn(key: string): boolean {
    const m = this._flags();
    return key in m ? m[key] : true;
  }

  // ── admin ──
  list(): Observable<FeatureFlagView[]> {
    return this.api.get<FeatureFlagView[]>('/admin/feature-flags');
  }

  set(
    key: string,
    patch: Partial<Pick<FeatureFlagView, 'enabled' | 'rolloutPercent' | 'allowedPlans'>>,
  ): Observable<FeatureFlagView> {
    return this.api.patch<FeatureFlagView>(`/admin/feature-flags/${key}`, patch);
  }
}
