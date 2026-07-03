import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface InstitutionOverview {
  orgName: string;
  cohorts: { id: string; name: string; students: number; sampledStudents: number; avgReadiness: number; atRisk: number }[];
  totals: { students: number; sampled: number; avgReadiness: number; atRisk: number; jobReady: number };
  topPerformers: { name: string; readiness: number }[];
  riskStudents: { name: string; readiness: number; topGap: string | null }[];
  weakConcepts: { concept: string; count: number }[];
}
export interface CohortOutcomes {
  id: string;
  name: string;
  total: number;
  sampled: number;
  students: { id: string; name: string; readiness: number; band: string; topGap: string | null; atRisk: boolean }[];
}
export type AssignmentKind = 'flow' | 'template' | 'roadmap' | 'course' | 'quiz' | 'project';
export interface Assignment {
  id: string;
  kind: AssignmentKind;
  title: string;
  note: string;
  dueAt: string | null;
  overdue: boolean;
  createdBy: string;
  createdAt: string;
}
export interface AssignInput {
  kind: AssignmentKind;
  title: string;
  note?: string;
  dueAt?: string;
}

@Injectable({ providedIn: 'root' })
export class InstitutionService {
  private readonly api = inject(ApiService);
  overview(): Observable<InstitutionOverview> { return this.api.get<InstitutionOverview>('/institution/overview'); }
  cohortOutcomes(id: string): Observable<CohortOutcomes> { return this.api.get<CohortOutcomes>(`/institution/cohorts/${id}/outcomes`); }
  assign(id: string, input: AssignInput): Observable<{ ok: true; id: string }> { return this.api.post<{ ok: true; id: string }>(`/institution/cohorts/${id}/assign`, input); }
  assignments(id: string): Observable<Assignment[]> { return this.api.get<Assignment[]>(`/institution/cohorts/${id}/assignments`); }
}
