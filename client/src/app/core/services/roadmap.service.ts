import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  GenerateRoadmapPayload,
  Roadmap,
  RoadmapStatus,
  RoadmapSummary,
  UpdateProgressPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class RoadmapService {
  private readonly api = inject(ApiService);

  generate(payload: GenerateRoadmapPayload): Observable<Roadmap> {
    return this.api.post<Roadmap>('/roadmaps/generate', payload);
  }

  getMine(): Observable<RoadmapSummary[]> {
    return this.api.get<RoadmapSummary[]>('/roadmaps/my');
  }

  getActive(): Observable<Roadmap | null> {
    return this.api.get<Roadmap | null>('/roadmaps/active');
  }

  getById(id: string): Observable<Roadmap> {
    return this.api.get<Roadmap>(`/roadmaps/${id}`);
  }

  updateProgress(id: string, payload: UpdateProgressPayload): Observable<Roadmap> {
    return this.api.patch<Roadmap>(`/roadmaps/${id}/progress`, payload);
  }

  updateStatus(id: string, status: RoadmapStatus): Observable<Roadmap> {
    return this.api.patch<Roadmap>(`/roadmaps/${id}/status`, { status });
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/roadmaps/${id}`);
  }
}
