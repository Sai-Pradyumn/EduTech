import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';

export interface IntegrationView {
  provider: string;
  name: string;
  category: string;
  mode: 'mock' | 'oauth' | 'manual' | 'export';
  description: string;
  connected: boolean;
  connectionId: string | null;
  lastSyncAt: string | null;
  metadata: Record<string, unknown>;
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
  /** Absolute URL for the .ics download (bypasses the JSON envelope). */
  calendarUrl(): string {
    return `${environment.apiBaseUrl}/integrations/calendar.ics`;
  }
}
