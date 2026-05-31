import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface SessionView {
  id: string;
  device: string;
  ip: string | null;
  lastSeenAt: string;
  current: boolean;
}

export interface BrandingView {
  orgId: string;
  logoUrl: string;
  accentColor: string;
  certificateTemplate: string;
  publicName: string;
  supportEmail: string;
}

export interface DataJobView {
  id: string;
  kind: 'export' | 'delete_request';
  status: string;
  fileUrl: string | null;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
}

/** Enterprise account controls (Phase 10 · M6/M14/M15): sessions, branding, data governance. */
@Injectable({ providedIn: 'root' })
export class EnterpriseService {
  private readonly api = inject(ApiService);

  // ── sessions ──
  sessions(): Observable<SessionView[]> {
    return this.api.get<SessionView[]>('/auth/sessions');
  }
  revokeSession(id: string): Observable<{ revoked: boolean }> {
    return this.api.delete(`/auth/sessions/${id}`);
  }
  logoutAll(): Observable<{ ok: boolean }> {
    return this.api.post('/auth/logout-all', {});
  }

  // ── branding ──
  branding(): Observable<BrandingView> {
    return this.api.get<BrandingView>('/org/branding');
  }
  updateBranding(patch: Partial<BrandingView>): Observable<BrandingView> {
    return this.api.patch<BrandingView>('/org/branding', patch);
  }

  // ── data governance ──
  exportMe(): Observable<DataJobView> {
    return this.api.post<DataJobView>('/data/export/me', {});
  }
  dataJobs(): Observable<DataJobView[]> {
    return this.api.get<DataJobView[]>('/data/export/jobs');
  }
  requestDeletion(note?: string): Observable<DataJobView> {
    return this.api.post<DataJobView>('/data/delete-request', { note });
  }
}
