import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface InstitutionOverview {
  orgName: string;
  cohorts: { id: string; name: string; students: number; avgReadiness: number; atRisk: number }[];
  totals: { students: number; avgReadiness: number; atRisk: number; jobReady: number };
  topPerformers: { name: string; readiness: number }[];
  riskStudents: { name: string; readiness: number; topGap: string | null }[];
  weakConcepts: { concept: string; count: number }[];
}
export interface CohortOutcomes {
  id: string;
  name: string;
  students: { id: string; name: string; readiness: number; band: string; topGap: string | null; atRisk: boolean }[];
}

@Injectable({ providedIn: 'root' })
export class InstitutionService {
  private readonly api = inject(ApiService);
  overview(): Observable<InstitutionOverview> { return this.api.get<InstitutionOverview>('/institution/overview'); }
  cohortOutcomes(id: string): Observable<CohortOutcomes> { return this.api.get<CohortOutcomes>(`/institution/cohorts/${id}/outcomes`); }
  assignFlow(id: string, title: string): Observable<{ ok: true }> { return this.api.post<{ ok: true }>(`/institution/cohorts/${id}/assign-flow`, { kind: 'flow', title }); }
  assignTemplate(id: string, title: string): Observable<{ ok: true }> { return this.api.post<{ ok: true }>(`/institution/cohorts/${id}/assign-template`, { kind: 'template', title }); }
}
