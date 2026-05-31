import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PrivacySettings {
  passport: { username: string; visibility: string; publicSettings: Record<string, boolean> };
  portfolio: { username: string; status: string };
  proof: { total: number; public: number };
}

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private readonly api = inject(ApiService);
  settings(): Observable<PrivacySettings> { return this.api.get<PrivacySettings>('/privacy/settings'); }
  exportData(): Observable<Record<string, unknown>> { return this.api.get<Record<string, unknown>>('/privacy/export'); }
  makePrivate(): Observable<{ ok: true }> { return this.api.post<{ ok: true }>('/privacy/make-private'); }
  resetSkillTwin(): Observable<{ clearedMistakes: number }> { return this.api.post<{ clearedMistakes: number }>('/privacy/reset-skill-twin'); }
  clearApplications(): Observable<{ deleted: number }> { return this.api.post<{ deleted: number }>('/privacy/clear-applications'); }
}
