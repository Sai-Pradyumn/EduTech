import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CohortDetail, CohortStatus, CohortView, LeaderboardRow } from '../models';

/** Cohort-based learning API (B3). */
@Injectable({ providedIn: 'root' })
export class CohortService {
  private readonly api = inject(ApiService);

  /** Cohorts I'm in as a student. */
  mine(): Observable<CohortView[]> {
    return this.api.get<CohortView[]>('/cohorts/mine');
  }

  /** Cohorts in my active organization (admins / mentors). */
  listForOrg(): Observable<CohortView[]> {
    return this.api.get<CohortView[]>('/cohorts');
  }

  create(input: { name: string; description?: string; roadmapGoal?: string; status?: CohortStatus }): Observable<CohortView> {
    return this.api.post<CohortView>('/cohorts', input);
  }

  detail(id: string): Observable<CohortDetail> {
    return this.api.get<CohortDetail>(`/cohorts/${id}`);
  }

  leaderboard(id: string): Observable<LeaderboardRow[]> {
    return this.api.get<LeaderboardRow[]>(`/cohorts/${id}/leaderboard`);
  }

  update(id: string, patch: { name?: string; description?: string; roadmapGoal?: string; status?: CohortStatus }): Observable<CohortView> {
    return this.api.patch<CohortView>(`/cohorts/${id}`, patch);
  }

  addMembers(id: string, userIds: string[], role: 'mentor' | 'student'): Observable<CohortDetail> {
    return this.api.post<CohortDetail>(`/cohorts/${id}/members`, { userIds, role });
  }

  removeMember(id: string, userId: string): Observable<CohortDetail> {
    return this.api.delete<CohortDetail>(`/cohorts/${id}/members/${userId}`);
  }

  announce(id: string, title: string, body: string): Observable<CohortDetail> {
    return this.api.post<CohortDetail>(`/cohorts/${id}/announcements`, { title, body });
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/cohorts/${id}`);
  }
}
