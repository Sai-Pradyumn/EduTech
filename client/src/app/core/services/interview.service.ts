import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface InterviewQA {
  id: string;
  question: string;
  answer: string;
  feedback: string;
  score: number | null;
  answered: boolean;
}
export interface InterviewSession {
  id: string;
  type: string;
  typeLabel: string;
  role: string;
  archetype: string | null;
  archetypeLabel: string | null;
  status: 'active' | 'finished';
  currentIndex: number;
  total: number;
  questions: InterviewQA[];
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  overallScore: number;
  summary: string;
  strengths: string[];
  weakConcepts: string[];
  createdAt: string;
}
export interface InterviewTypeMeta { type: string; label: string; focus: string }
export interface InterviewArchetype { id: string; label: string }

@Injectable({ providedIn: 'root' })
export class InterviewService {
  private readonly api = inject(ApiService);
  types(): Observable<InterviewTypeMeta[]> { return this.api.get<InterviewTypeMeta[]>('/interview/types'); }
  /** Company styles that tune the question difficulty ladder. */
  archetypes(): Observable<InterviewArchetype[]> { return this.api.get<InterviewArchetype[]>('/interview/archetypes'); }
  start(type: string, roleId?: string, archetype?: string): Observable<InterviewSession> {
    return this.api.post<InterviewSession>('/interview/start', { type, roleId, ...(archetype ? { archetype } : {}) });
  }
  respond(id: string, answer: string): Observable<InterviewSession> { return this.api.post<InterviewSession>(`/interview/${id}/respond`, { answer }); }
  skip(id: string): Observable<InterviewSession> { return this.api.post<InterviewSession>(`/interview/${id}/skip`, {}); }
  finish(id: string): Observable<InterviewSession> { return this.api.post<InterviewSession>(`/interview/${id}/finish`); }
  sessions(): Observable<InterviewSession[]> { return this.api.get<InterviewSession[]>('/interview/sessions'); }
  session(id: string): Observable<InterviewSession> { return this.api.get<InterviewSession>(`/interview/sessions/${id}`); }
}
