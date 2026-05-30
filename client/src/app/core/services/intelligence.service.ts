import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { LearningIntelligence } from '../models';

/** Learning-Intelligence cockpit API. */
@Injectable({ providedIn: 'root' })
export class IntelligenceService {
  private readonly api = inject(ApiService);

  /** Cached overview so lightweight consumers (topbar streak) don't re-fetch. */
  readonly snapshot = signal<LearningIntelligence | null>(null);
  private loading = false;

  /** Real learning streak (days) from the cached overview, 0 until loaded. */
  readonly streak = computed(() => this.snapshot()?.momentum.streak ?? 0);

  overview(): Observable<LearningIntelligence> {
    return this.api
      .get<LearningIntelligence>('/intelligence/overview')
      .pipe(tap((d) => this.snapshot.set(d)));
  }

  /** Fetch once and cache (idempotent). Errors are swallowed — the streak just stays 0. */
  load(): void {
    if (this.snapshot() || this.loading) return;
    this.loading = true;
    this.overview().subscribe({
      next: () => (this.loading = false),
      error: () => (this.loading = false),
    });
  }
}
