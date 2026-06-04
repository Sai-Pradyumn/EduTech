import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';

export interface IntegrationView {
  provider: string;
  name: string;
  category: string;
  mode: 'webhook' | 'oauth' | 'manual' | 'csv' | 'export';
  description: string;
  connected: boolean;
  connectionId: string | null;
  lastSyncAt: string | null;
  metadata: Record<string, unknown>;
}

export interface LmsImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

/** Integrations foundation API (Phase 10 · M12). */
@Injectable({ providedIn: 'root' })
export class IntegrationService {
  private readonly api = inject(ApiService);

  list(): Observable<IntegrationView[]> {
    return this.api.get<IntegrationView[]>('/integrations');
  }
  connect(provider: string, metadata?: Record<string, unknown>): Observable<{ connected: boolean }> {
    return this.api.post('/integrations/connect', { provider, metadata });
  }
  disconnect(provider: string): Observable<{ disconnected: boolean }> {
    return this.api.post('/integrations/disconnect', { provider });
  }
  sync(provider: string): Observable<{ synced: boolean }> {
    return this.api.post('/integrations/sync', { provider });
  }
  /** Post a message to a connected chat webhook (Slack/Discord). */
  announce(provider: string, message: string): Observable<{ sent: boolean }> {
    return this.api.post('/integrations/announce', { provider, message });
  }
  /** Import an LMS roster from raw CSV text. */
  importCsv(provider: string, csv: string): Observable<LmsImportResult> {
    return this.api.post(`/integrations/${provider}/import`, { csv });
  }
  /** Begin an OAuth flow; returns the provider consent URL to redirect to. */
  oauthStart(provider: string): Observable<{ authUrl: string }> {
    return this.api.get(`/integrations/${provider}/oauth/start`);
  }
  /** Absolute URL for the .ics download (bypasses the JSON envelope). */
  calendarUrl(): string {
    return `${environment.apiBaseUrl}/integrations/calendar.ics`;
  }
}
