import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type SpaceSourceType = 'document' | 'text' | 'url' | 'transcript' | 'voice_session' | 'visual' | 'roadmap' | 'project' | 'tutor_message';

export interface SpaceSource {
  id: string;
  type: SpaceSourceType;
  title: string;
  text: string;
  url: string | null;
  ref: string | null;
  addedAt: string;
}
export interface SpaceArtifact {
  id: string;
  kind: 'summary' | 'flashcards' | 'audio_overview' | 'concept_map';
  title: string;
  content: string;
  createdAt: string;
}
export interface StudySpace {
  id: string;
  title: string;
  description: string;
  sources: SpaceSource[];
  artifacts: SpaceArtifact[];
  linkedFlowIds: string[];
  linkedVisualIds: string[];
  linkedQuizIds: string[];
  linkedVoiceSessionIds: string[];
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly api = inject(ApiService);

  list(): Observable<StudySpace[]> { return this.api.get<StudySpace[]>('/spaces'); }
  get(id: string): Observable<StudySpace> { return this.api.get<StudySpace>(`/spaces/${id}`); }
  create(body: { title: string; description?: string }): Observable<StudySpace> { return this.api.post<StudySpace>('/spaces', body); }
  addSource(id: string, body: { type: SpaceSourceType; title: string; text?: string; url?: string }): Observable<StudySpace> {
    return this.api.post<StudySpace>(`/spaces/${id}/sources`, body);
  }
  removeSource(id: string, sourceId: string): Observable<StudySpace> { return this.api.delete<StudySpace>(`/spaces/${id}/sources/${sourceId}`); }
  ask(id: string, question: string): Observable<{ answer: string; usedSources: string[] }> { return this.api.post(`/spaces/${id}/ask`, { question }); }
  summary(id: string): Observable<StudySpace> { return this.api.post<StudySpace>(`/spaces/${id}/summary`, {}); }
  flashcards(id: string): Observable<StudySpace> { return this.api.post<StudySpace>(`/spaces/${id}/flashcards`, {}); }
  audioOverview(id: string): Observable<{ space: StudySpace; script: string }> { return this.api.post(`/spaces/${id}/audio-overview`, {}); }
  createFlow(id: string): Observable<{ space: StudySpace; flowId: string }> { return this.api.post(`/spaces/${id}/flow`, {}); }
  createQuiz(id: string): Observable<{ space: StudySpace; quizId: string }> { return this.api.post(`/spaces/${id}/quiz`, {}); }
  createVisual(id: string): Observable<{ space: StudySpace; visualId: string }> { return this.api.post(`/spaces/${id}/visuals`, {}); }
  remove(id: string): Observable<{ ok: true }> { return this.api.delete<{ ok: true }>(`/spaces/${id}`); }
}
