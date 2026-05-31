import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type LedgerKind =
  | 'node_completed' | 'quiz_passed' | 'mistake_resolved' | 'simulation_finished'
  | 'project_submitted' | 'week_completed' | 'flow_generated' | 'certificate_earned'
  | 'quiz_failed' | 'project_ai_reviewed' | 'project_mentor_approved' | 'voice_viva_passed'
  | 'mentor_feedback_added' | 'skill_mastery_increased' | 'daily_plan_completed'
  | 'interview_completed' | 'interview_passed' | 'evidence_added';

export type VerificationLevel = 'self' | 'ai' | 'system' | 'mentor' | 'certificate';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  title: string;
  detail: string;
  score: number | null;
  evidenceRef: string | null;
  skills: string[];
  verificationLevel: VerificationLevel;
  visibleOnPassport: boolean;
  at: string;
}
export interface LedgerStats {
  total: number;
  byKind: { kind: string; count: number }[];
  activeDays: number;
  latestAt: string | null;
}
export interface LedgerSummary extends LedgerStats {
  byVerification: { level: VerificationLevel; count: number }[];
  verifiedCount: number;
  publicCount: number;
  skills: { skill: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly api = inject(ApiService);
  list(): Observable<LedgerEntry[]> { return this.api.get<LedgerEntry[]>('/proof-ledger'); }
  stats(): Observable<LedgerStats> { return this.api.get<LedgerStats>('/proof-ledger/stats'); }
  summary(): Observable<LedgerSummary> { return this.api.get<LedgerSummary>('/proof-ledger/summary'); }
  setVisibility(id: string, visible: boolean): Observable<{ ok: true }> {
    return this.api.patch<{ ok: true }>(`/proof-ledger/events/${id}/visibility`, { visible });
  }
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
  quiz_failed: { label: 'Quiz attempt', glyph: '✗' },
  project_ai_reviewed: { label: 'Project reviewed', glyph: '🔍' },
  project_mentor_approved: { label: 'Mentor approved', glyph: '👤' },
  voice_viva_passed: { label: 'Voice viva', glyph: '🎙' },
  mentor_feedback_added: { label: 'Mentor feedback', glyph: '💬' },
  skill_mastery_increased: { label: 'Mastery up', glyph: '📈' },
  daily_plan_completed: { label: 'Daily plan', glyph: '☑' },
  interview_completed: { label: 'Interview', glyph: '🧩' },
  interview_passed: { label: 'Interview passed', glyph: '🏆' },
  evidence_added: { label: 'Evidence added', glyph: '➕' },
};
