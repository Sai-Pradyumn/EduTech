import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Template {
  id: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
  level: string;
  targetRole: string;
  creatorName: string;
  status: string;
  usageCount: number;
  rating: { avg: number; count: number };
  reviewNote?: string;
  content?: Record<string, unknown>;
}
export interface UseTemplateResult {
  ok: true;
  type: string;
  /** True when a real personal asset was cloned; false when we seeded a create screen. */
  created: boolean;
  assetId: string | null;
  route: string;
  queryParams?: Record<string, string>;
}
export interface CreateTemplateInput {
  type: string;
  title: string;
  description?: string;
  tags?: string[];
  level?: string;
  targetRole?: string;
  content?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly api = inject(ApiService);
  list(type?: string): Observable<Template[]> { return this.api.get<Template[]>('/marketplace/templates', type ? { type } : undefined); }
  mine(): Observable<Template[]> { return this.api.get<Template[]>('/marketplace/templates/mine'); }
  pending(): Observable<Template[]> { return this.api.get<Template[]>('/marketplace/templates/pending'); }
  get(id: string): Observable<Template> { return this.api.get<Template>(`/marketplace/templates/${id}`); }
  create(input: CreateTemplateInput): Observable<{ id: string; status: string }> { return this.api.post<{ id: string; status: string }>('/marketplace/templates', input); }
  submit(id: string): Observable<{ id: string; status: string }> { return this.api.post<{ id: string; status: string }>(`/marketplace/templates/${id}/publish`); }
  review(id: string, decision: 'published' | 'rejected', note?: string): Observable<{ id: string; status: string }> { return this.api.post<{ id: string; status: string }>(`/marketplace/templates/${id}/review`, { decision, note }); }
  use(id: string): Observable<UseTemplateResult> { return this.api.post<UseTemplateResult>(`/marketplace/templates/${id}/use`); }
}
