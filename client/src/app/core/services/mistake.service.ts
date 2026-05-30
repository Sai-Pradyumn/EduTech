import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type MistakeType =
  | 'misconception'
  | 'missing_prerequisite'
  | 'careless_error'
  | 'weak_recall'
  | 'poor_explanation'
  | 'implementation_gap'
  | 'interview_communication_gap'
  | 'project_architecture_gap';

export type MistakeStatus = 'open' | 'repairing' | 'resolved';
export type RepairActionKind = 'micro_quiz' | 'visual_correction' | 'tutor_explanation' | 'voice_viva' | 'flow_repair_node';

export interface RepairAction {
  id: string;
  kind: RepairActionKind;
  label: string;
  route: string | null;
  prompt: string | null;
  done: boolean;
}

export interface Mistake {
  id: string;
  concept: string;
  topic: string;
  mistakeType: MistakeType;
  wrongReasoning: string;
  correction: string;
  severity: number;
  frequency: number;
  source: string;
  sourceId: string | null;
  status: MistakeStatus;
  repairActions: RepairAction[];
  linkedQuizId: string | null;
  linkedFlowId: string | null;
  linkedVisualId: string | null;
  lastSeenAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface MistakeStats {
  open: number;
  repairing: number;
  resolved: number;
  avgSeverity: number;
  topFocus: { id: string; concept: string; severity: number } | null;
  heatmap: { topic: string; severity: number; frequency: number; status: MistakeStatus }[];
}

@Injectable({ providedIn: 'root' })
export class MistakeService {
  private readonly api = inject(ApiService);

  list(status?: MistakeStatus): Observable<Mistake[]> {
    return this.api.get<Mistake[]>('/mistakes', status ? { status } : undefined);
  }
  stats(): Observable<MistakeStats> {
    return this.api.get<MistakeStats>('/mistakes/stats');
  }
  repair(id: string): Observable<Mistake> {
    return this.api.post<Mistake>(`/mistakes/${id}/repair`, {});
  }
  setStatus(id: string, status: MistakeStatus): Observable<Mistake> {
    return this.api.patch<Mistake>(`/mistakes/${id}/status`, { status });
  }
  toggleAction(id: string, actionId: string, done: boolean): Observable<Mistake> {
    return this.api.patch<Mistake>(`/mistakes/${id}/actions`, { actionId, done });
  }
  repairFlow(id: string): Observable<{ mistake: Mistake; flowId: string | null; nodeId: string | null }> {
    return this.api.post<{ mistake: Mistake; flowId: string | null; nodeId: string | null }>(`/mistakes/${id}/repair-flow`, {});
  }
  remove(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/mistakes/${id}`);
  }
}

export const MISTAKE_TYPE_LABEL: Record<MistakeType, string> = {
  misconception: 'Misconception',
  missing_prerequisite: 'Missing prerequisite',
  careless_error: 'Careless error',
  weak_recall: 'Weak recall',
  poor_explanation: 'Poor explanation',
  implementation_gap: 'Implementation gap',
  interview_communication_gap: 'Communication gap',
  project_architecture_gap: 'Architecture gap',
};
