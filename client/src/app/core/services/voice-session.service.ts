import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type VoiceMode = 'tutor' | 'viva' | 'interview' | 'doubt' | 'flow_builder' | 'revision' | 'mentor' | 'project_review';

export interface VoiceTurn {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface VoiceSession {
  id: string;
  mode: VoiceMode;
  title: string;
  transcript: VoiceTurn[];
  summary: string;
  extractedActions: string[];
  linkedFlowId: string | null;
  linkedQuizId: string | null;
  linkedRoadmapId: string | null;
  linkedProjectId: string | null;
  durationMs: number;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface TurnResult {
  sessionId: string;
  text: string;
  speak: { text: string; voice: string; provider: string; audioUrl?: string };
}

@Injectable({ providedIn: 'root' })
export class VoiceSessionService {
  private readonly api = inject(ApiService);

  status(): Observable<{ enabled: boolean; provider: string; serverStt: boolean; serverTts: boolean }> {
    return this.api.get('/voice/status');
  }
  create(mode: VoiceMode): Observable<VoiceSession> {
    return this.api.post<VoiceSession>('/voice/sessions', { mode });
  }
  list(): Observable<VoiceSession[]> {
    return this.api.get<VoiceSession[]>('/voice/sessions');
  }
  get(id: string): Observable<VoiceSession> {
    return this.api.get<VoiceSession>(`/voice/sessions/${id}`);
  }
  turn(id: string, transcript: string): Observable<TurnResult> {
    return this.api.post<TurnResult>(`/voice/sessions/${id}/turn`, { transcript });
  }
  rename(id: string, title: string): Observable<VoiceSession> {
    return this.api.patch<VoiceSession>(`/voice/sessions/${id}`, { title });
  }
  summarize(id: string): Observable<VoiceSession> {
    return this.api.post<VoiceSession>(`/voice/sessions/${id}/summarize`, {});
  }
  createFlow(id: string): Observable<{ session: VoiceSession; flowId: string }> {
    return this.api.post(`/voice/sessions/${id}/create-flow`, {});
  }
  createQuiz(id: string): Observable<{ session: VoiceSession; quizId: string }> {
    return this.api.post(`/voice/sessions/${id}/create-quiz`, {});
  }
  extractNotes(id: string): Observable<{ notes: string; actions: string[] }> {
    return this.api.post(`/voice/sessions/${id}/extract-notes`, {});
  }
  end(id: string, durationMs?: number): Observable<VoiceSession> {
    return this.api.post<VoiceSession>(`/voice/sessions/${id}/end`, { durationMs });
  }
  remove(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/voice/sessions/${id}`);
  }
}

export const VOICE_MODE_META: Record<VoiceMode, { label: string; glyph: string; blurb: string }> = {
  tutor: { label: 'Tutor', glyph: '🎓', blurb: 'Explain + Socratic questions' },
  viva: { label: 'Viva', glyph: '🗣', blurb: 'Oral test on a topic' },
  interview: { label: 'Interview', glyph: '💼', blurb: 'Mock interview prep' },
  doubt: { label: 'Doubt solver', glyph: '❓', blurb: 'Quick spoken clarifications' },
  flow_builder: { label: 'Flow builder', glyph: '🧭', blurb: 'Speak a goal → build a flow' },
  revision: { label: 'Revision', glyph: '🔁', blurb: 'Recap your notes' },
  mentor: { label: 'Mentor', glyph: '🧑‍🏫', blurb: 'Plan + motivation' },
  project_review: { label: 'Project review', glyph: '🛠', blurb: 'Explain + get feedback' },
};

export const VOICE_MODE_LIST: VoiceMode[] = ['tutor', 'viva', 'interview', 'doubt', 'flow_builder', 'revision', 'mentor', 'project_review'];
