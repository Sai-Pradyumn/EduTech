import { Injectable } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';

/** Domains a state change can affect — mirrors the server's DomainKey vocabulary. */
export type DomainKey =
  | 'roadmap'
  | 'dailyPlan'
  | 'dashboard'
  | 'intelligence'
  | 'mistakes'
  | 'course'
  | 'flows'
  | 'skillTwin'
  | 'ledger'
  | 'memory'
  | 'profile';

/**
 * App-wide invalidation bus. When Asta (or a chat command) writes a domain, the
 * agent response carries an `invalidate` receipt; the chat surface pushes it here,
 * and any open screen subscribed to those domains reloads its data. This is what
 * makes "mark week 2 done" in chat refresh the roadmap, Today AND the dashboard at
 * once — instead of leaving them stale until a manual reload.
 */
@Injectable({ providedIn: 'root' })
export class DomainBusService {
  private readonly _changes = new Subject<DomainKey>();

  /** Push a receipt (from `AgentResponse.invalidate`) onto the bus. */
  invalidate(domains: readonly string[] | undefined): void {
    if (!domains?.length) return;
    for (const d of domains) this._changes.next(d as DomainKey);
  }

  /** Emits whenever ANY of `domains` is invalidated (dedupe/reload downstream). */
  on(domains: readonly DomainKey[]): Observable<DomainKey> {
    return this._changes.pipe(filter((d) => domains.includes(d)));
  }
}
