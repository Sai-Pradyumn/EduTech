import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FineTuningJob, GraphRun, GraphTemplate, VoiceStatus, VoiceTurn } from '../models';

/** A5 Voice Room API (gated by ENABLE_REALTIME_VOICE). */
@Injectable({ providedIn: 'root' })
export class VoiceApiService {
  private readonly api = inject(ApiService);
  status(): Observable<VoiceStatus> {
    return this.api.get<VoiceStatus>('/voice/status');
  }
  ask(transcript: string, sessionId?: string, mode: 'tutor' | 'interview' = 'tutor'): Observable<VoiceTurn> {
    return this.api.post<VoiceTurn>('/voice/ask', { transcript, sessionId, mode });
  }
}

/** A8 Fine-Tuning Lab API (gated by ENABLE_FINE_TUNING; Role.Admin). */
@Injectable({ providedIn: 'root' })
export class FineTuningApiService {
  private readonly api = inject(ApiService);
  status(): Observable<{ enabled: boolean }> {
    return this.api.get<{ enabled: boolean }>('/fine-tuning/status');
  }
  list(): Observable<FineTuningJob[]> {
    return this.api.get<FineTuningJob[]>('/fine-tuning/jobs');
  }
  create(input: { name: string; baseModel?: string; datasetSize?: number; epochs?: number }): Observable<FineTuningJob> {
    return this.api.post<FineTuningJob>('/fine-tuning/jobs', input);
  }
  cancel(id: string): Observable<FineTuningJob> {
    return this.api.post<FineTuningJob>(`/fine-tuning/jobs/${id}/cancel`, {});
  }
}

/** A9 Agent-graph API (gated by ENABLE_LANGGRAPH). */
@Injectable({ providedIn: 'root' })
export class AgentGraphApiService {
  private readonly api = inject(ApiService);
  status(): Observable<{ enabled: boolean; graphs: number }> {
    return this.api.get<{ enabled: boolean; graphs: number }>('/agent-graph/status');
  }
  graphs(): Observable<GraphTemplate[]> {
    return this.api.get<GraphTemplate[]>('/agent-graph/graphs');
  }
  runs(): Observable<GraphRun[]> {
    return this.api.get<GraphRun[]>('/agent-graph/runs');
  }
  getRun(id: string): Observable<GraphRun> {
    return this.api.get<GraphRun>(`/agent-graph/runs/${id}`);
  }
  run(graph: string, input: string): Observable<GraphRun> {
    return this.api.post<GraphRun>('/agent-graph/runs', { graph, input });
  }
}
