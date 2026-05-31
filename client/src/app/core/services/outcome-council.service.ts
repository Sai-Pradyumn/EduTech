import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CouncilAction {
  id: string;
  agent: string;
  action: string;
  why: string;
  expectedImpact: number;
  timeRequired: string;
  route: string;
  riskIfIgnored: string;
}
export interface CouncilResult {
  verdict: string;
  best: CouncilAction | null;
  alternatives: CouncilAction[];
  context: { role: string; readinessScore: number; band: string };
  generatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class OutcomeCouncilService {
  private readonly api = inject(ApiService);
  recommend(): Observable<CouncilResult> { return this.api.post<CouncilResult>('/outcome-council/recommend'); }
  latest(): Observable<CouncilResult | null> { return this.api.get<CouncilResult | null>('/outcome-council/latest'); }
}
