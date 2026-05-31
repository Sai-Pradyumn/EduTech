import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}
export interface CreatedKey extends Omit<ApiKeyView, 'lastUsedAt' | 'createdAt'> {
  key: string; // shown once
}
export interface WebhookView {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
}
export interface DeliveryView {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  responseCode: number | null;
  error: string | null;
  attempts: number;
  createdAt: string;
}

/** Developer platform API (Phase 10 · M11): org API keys + webhooks. */
@Injectable({ providedIn: 'root' })
export class DeveloperService {
  private readonly api = inject(ApiService);

  events(): Observable<string[]> {
    return this.api.get<string[]>('/developer/events');
  }
  keys(): Observable<ApiKeyView[]> {
    return this.api.get<ApiKeyView[]>('/developer/api-keys');
  }
  createKey(name: string, scopes: string[] = []): Observable<CreatedKey> {
    return this.api.post<CreatedKey>('/developer/api-keys', { name, scopes });
  }
  revokeKey(id: string): Observable<{ revoked: boolean }> {
    return this.api.delete(`/developer/api-keys/${id}`);
  }
  webhooks(): Observable<WebhookView[]> {
    return this.api.get<WebhookView[]>('/developer/webhooks');
  }
  createWebhook(url: string, events: string[]): Observable<WebhookView> {
    return this.api.post<WebhookView>('/developer/webhooks', { url, events });
  }
  deleteWebhook(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete(`/developer/webhooks/${id}`);
  }
  testWebhook(id: string): Observable<{ status: string; responseCode: number | null }> {
    return this.api.post(`/developer/webhooks/${id}/test`, {});
  }
  deliveries(): Observable<DeliveryView[]> {
    return this.api.get<DeliveryView[]>('/developer/webhook-deliveries');
  }
}
