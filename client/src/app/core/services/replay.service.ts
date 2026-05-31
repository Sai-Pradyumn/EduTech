import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface LearningReplay {
  generatedAt: string;
  windowDays: number;
  readinessScore: number;
  pace: string;
  modality: { modality: string; reason: string };
  did: { kind: string; title: string; detail: string; at: string }[];
  struggled: { concept: string; severity: number }[];
  nextActions: { label: string; reason: string; route: string }[];
  recapScript: string;
}

@Injectable({ providedIn: 'root' })
export class ReplayService {
  private readonly api = inject(ApiService);
  generate(): Observable<LearningReplay> { return this.api.get<LearningReplay>('/replay'); }
}
