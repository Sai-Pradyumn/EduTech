import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  GenerateRoadmapPayload,
  Roadmap,
  RoadmapStatus,
  RoadmapSummary,
  RoadmapVersionDiff,
  RoadmapVersionSummary,
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

  /** Regenerate a single week in place (optionally with an adjustment note). */
  regenerateWeek(id: string, weekNumber: number, note?: string): Observable<Roadmap> {
    return this.api.post<Roadmap>(`/roadmaps/${id}/regenerate-week`, { weekNumber, note });
  }

  /** Adaptive re-plan: regenerate the next uncompleted weeks to fit real pace. */
  replan(id: string, note?: string): Observable<Roadmap> {
    return this.api.post<Roadmap>(`/roadmaps/${id}/replan`, note ? { note } : {});
  }

  /** Git-style content history (newest first). */
  versions(id: string): Observable<RoadmapVersionSummary[]> {
    return this.api.get<RoadmapVersionSummary[]>(`/roadmaps/${id}/versions`);
  }

  /** Preview what restoring a version would change (read-only). */
  versionDiff(id: string, version: number): Observable<RoadmapVersionDiff> {
    return this.api.get<RoadmapVersionDiff>(`/roadmaps/${id}/versions/${version}/diff`);
  }

  /** Restore the roadmap content to an earlier version (progress survives). */
  restoreVersion(id: string, version: number): Observable<Roadmap> {
    return this.api.post<Roadmap>(`/roadmaps/${id}/versions/${version}/restore`, {});
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/roadmaps/${id}`);
  }
}
