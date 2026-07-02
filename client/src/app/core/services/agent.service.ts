import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SocketService } from './socket.service';
import {
  AgentMessageView,
  AgentResponse,
  AgentSessionSummary,
  AgentStreamEvent,
  AiProvidersSnapshot,
  NextAction,
  SessionSearchHit,
} from '../models';

export interface AgentMessageResult {
  sessionId: string;
  messageId: string;
  response: AgentResponse;
}

/** Facade over the Agent OS: streaming (WebSocket) + REST (fallback, history, feedback). */
@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);

  /** Preferred path — streams workflow + tokens live. */
  stream(payload: { message: string; sessionId?: string; mode?: string; agentType?: string; documentIds?: string[] }): Observable<AgentStreamEvent> {
    return this.socket.streamAgent(payload);
  }

  /** Non-streaming fallback. */
  send(message: string, opts: { sessionId?: string; mode?: string; agentType?: string } = {}): Observable<AgentMessageResult> {
    return this.api.post<AgentMessageResult>('/ai/agent/message', { message, ...opts });
  }

  listSessions(): Observable<AgentSessionSummary[]> {
    return this.api.get<AgentSessionSummary[]>('/ai/sessions');
  }

  getMessages(sessionId: string): Observable<AgentMessageView[]> {
    return this.api.get<AgentMessageView[]>(`/ai/sessions/${sessionId}`);
  }

  /** Search across ALL past sessions (titles + message content). */
  searchSessions(q: string): Observable<SessionSearchHit[]> {
    return this.api.get<SessionSearchHit[]>(`/ai/sessions/search?q=${encodeURIComponent(q)}`);
  }

  /** Pin/unpin a session — pinned sessions lead every history list. */
  pinSession(sessionId: string, pinned: boolean): Observable<{ ok: boolean }> {
    return this.api.patch<{ ok: boolean }>(`/ai/sessions/${sessionId}/pin`, { pinned });
  }

  sendFeedback(rating: string, messageId?: string, reason?: string): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('/ai/feedback', { rating, messageId, reason });
  }

  /** Proactive "Your next move" computed from the learner's current state. */
  nextAction(): Observable<NextAction> {
    return this.api.get<NextAction>('/ai/next-action');
  }

  /** Admin-only: live AI provider chain + health snapshot. */
  aiProviders(): Observable<AiProvidersSnapshot> {
    return this.api.get<AiProvidersSnapshot>('/ai/providers');
  }
}
