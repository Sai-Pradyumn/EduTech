import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface OpsHealth {
  status: string;
  service: string;
  version: string;
  commit: string;
  node: string;
  uptimeSec: number;
  checks: Record<string, { status: string; state?: string }>;
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  errors24h?: number;
  jobsFailed?: number;
  time: string;
}

export interface JobView {
  id: string;
  queue: string;
  name: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
}

export interface ErrorView {
  errorId: string;
  requestId: string | null;
  status: number;
  code: string;
  message: string;
  route: string | null;
  method: string | null;
  createdAt: string;
}

export interface RealtimeStatus {
  websocketStatus: string;
  time: string;
  note: string;
}

export interface StorageStatus {
  provider: string;
  bucket: string | null;
  status: string;
  note: string;
}

export interface AiOpsOverview {
  windowDays: number;
  calls: number;
  tokens: number;
  costUsd: number;
  avgLatencyMs: number;
  fallbackRate: number;
  errorRate: number;
}

export interface AuditView {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Admin ops/observability reads (Phase 10 · M2/M6/M7/M8). Role.Admin endpoints. */
@Injectable({ providedIn: 'root' })
export class OpsService {
  private readonly api = inject(ApiService);

  // ── Ops Command Center ──
  metrics(): Observable<OpsHealth> {
    return this.api.get<OpsHealth>('/ops/metrics');
  }
  jobs(): Observable<{ counts: Record<string, number>; recent: JobView[] }> {
    return this.api.get('/ops/jobs');
  }
  retryJob(id: string): Observable<{ retried: boolean }> {
    return this.api.post(`/ops/jobs/${id}/retry`, {});
  }
  failedJobs(): Observable<JobView[]> {
    return this.api.get<JobView[]>('/ops/jobs/failed');
  }
  errors(): Observable<ErrorView[]> {
    return this.api.get<ErrorView[]>('/ops/errors');
  }
  realtime(): Observable<RealtimeStatus> {
    return this.api.get<RealtimeStatus>('/ops/realtime');
  }
  storage(): Observable<StorageStatus> {
    return this.api.get<StorageStatus>('/ops/storage');
  }

  // ── AI Ops ──
  aiOverview(days = 30): Observable<AiOpsOverview> {
    return this.api.get<AiOpsOverview>('/admin/ai-ops/overview', { days });
  }
  aiCosts(days = 30): Observable<{
    byDay: { day: string; costUsd: number; calls: number }[];
    byFeature: { feature: string; costUsd: number; calls: number; tokens: number }[];
    topUsers: { userId: string; name: string; email: string; costUsd: number; calls: number }[];
  }> {
    return this.api.get('/admin/ai-ops/costs', { days });
  }
  aiProviders(): Observable<{
    strategy: string;
    live: boolean;
    providers: { name: string; live: boolean; available: boolean }[];
  }> {
    return this.api.get('/admin/ai-ops/providers');
  }

  // ── Audit ──
  auditLogs(): Observable<AuditView[]> {
    return this.api.get<AuditView[]>('/admin/audit-logs');
  }

  // ── Product analytics ──
  productOverview(days = 30): Observable<{
    dau: number;
    wau: number;
    totalEvents: number;
    byEvent: { event: string; count: number }[];
  }> {
    return this.api.get('/admin/product-analytics/overview', { days });
  }
  funnels(days = 30): Observable<
    { name: string; steps: { event: string; users: number; conversionPct: number }[] }[]
  > {
    return this.api.get('/admin/product-analytics/funnels', { days });
  }
  retention(days = 30): Observable<{ day: string; activeUsers: number }[]> {
    return this.api.get('/admin/product-analytics/retention', { days });
  }
}
