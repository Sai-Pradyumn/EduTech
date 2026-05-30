import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';
import {
  ApiResponse,
  DocumentSummary,
  Flashcard,
  GroundedAnswer,
  IngestResult,
  KnowledgeDoc,
} from '../models';

/** Knowledge Hub API: ingestion, library, grounded ask, summary, flashcards. */
@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  uploadFile(file: File, title?: string): Observable<IngestResult> {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return this.http
      .post<ApiResponse<IngestResult>>(`${this.base}/knowledge/upload`, form)
      .pipe(map((res) => this.unwrap(res)));
  }

  uploadText(title: string, content: string): Observable<IngestResult> {
    return this.api.post<IngestResult>('/knowledge/text', { title, content });
  }

  list(): Observable<KnowledgeDoc[]> {
    return this.api.get<KnowledgeDoc[]>('/knowledge/documents');
  }

  get(id: string): Observable<KnowledgeDoc> {
    return this.api.get<KnowledgeDoc>(`/knowledge/documents/${id}`);
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/knowledge/documents/${id}`);
  }

  summary(id: string): Observable<DocumentSummary> {
    return this.api.get<DocumentSummary>(`/knowledge/documents/${id}/summary`);
  }

  flashcards(id: string): Observable<Flashcard[]> {
    return this.api.get<Flashcard[]>(`/knowledge/documents/${id}/flashcards`);
  }

  /** Non-streaming grounded answer (the Hub uses the streaming RAG agent for chat). */
  ask(question: string, documentIds?: string[]): Observable<GroundedAnswer> {
    return this.api.post<GroundedAnswer>('/knowledge/ask', { question, documentIds });
  }

  private unwrap<T>(res: ApiResponse<T>): T {
    if (res.success) return res.data;
    throw new Error(res.error.message);
  }
}
