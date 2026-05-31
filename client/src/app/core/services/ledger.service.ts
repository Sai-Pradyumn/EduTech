import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type LedgerKind =
  | 'node_completed' | 'quiz_passed' | 'mistake_resolved' | 'simulation_finished'
  | 'project_submitted' | 'week_completed' | 'flow_generated' | 'certificate_earned';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  title: string;
  detail: string;
  score: number | null;
  evidenceRef: string | null;
  at: string;
}
export interface LedgerStats {
  total: number;
  byKind: { kind: string; count: number }[];
  activeDays: number;
  latestAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly api = inject(ApiService);
  list(): Observable<LedgerEntry[]> { return this.api.get<LedgerEntry[]>('/ledger'); }
  stats(): Observable<LedgerStats> { return this.api.get<LedgerStats>('/ledger/stats'); }
}

export const LEDGER_KIND_META: Record<LedgerKind, { label: string; glyph: string }> = {
  node_completed: { label: 'Node completed', glyph: '✅' },
  quiz_passed: { label: 'Quiz passed', glyph: '✓' },
  mistake_resolved: { label: 'Mistake resolved', glyph: '🛠' },
  simulation_finished: { label: 'Simulation', glyph: '🎯' },
  project_submitted: { label: 'Project submitted', glyph: '⬢' },
  week_completed: { label: 'Week completed', glyph: '📅' },
  flow_generated: { label: 'Flow created', glyph: '🧭' },
  certificate_earned: { label: 'Certificate', glyph: '🏅' },
};
