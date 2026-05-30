import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CreateSessionRequest, SessionDetail, SessionView } from '../models';

/** Live session API (Phase 4 · B4). */
@Injectable({ providedIn: 'root' })
export class LiveSessionService {
  private readonly api = inject(ApiService);

  /** Sessions for the cohorts I'm in. */
  mine(): Observable<SessionView[]> {
    return this.api.get<SessionView[]>('/live-sessions/mine');
  }

  /** Sessions in my active organization (hosts / admins). */
  listForOrg(): Observable<SessionView[]> {
    return this.api.get<SessionView[]>('/live-sessions');
  }

  create(input: CreateSessionRequest): Observable<SessionDetail> {
    return this.api.post<SessionDetail>('/live-sessions', input);
  }

  detail(id: string): Observable<SessionDetail> {
    return this.api.get<SessionDetail>(`/live-sessions/${id}`);
  }

  start(id: string): Observable<SessionDetail> {
    return this.api.post<SessionDetail>(`/live-sessions/${id}/start`, {});
  }

  end(id: string, notes: string): Observable<SessionDetail> {
    return this.api.post<SessionDetail>(`/live-sessions/${id}/end`, { notes });
  }

  join(id: string): Observable<SessionDetail> {
    return this.api.post<SessionDetail>(`/live-sessions/${id}/join`, {});
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/live-sessions/${id}`);
  }
}
