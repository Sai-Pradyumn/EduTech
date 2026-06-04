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

/** One persisted grounded-Q&A turn (server-side history, syncs across devices). */
export interface QaTurn {
  id: string;
  question: string;
  answer: string;
  sources: unknown[];
  confidence: number;
  createdAt: string;
}

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

  /** Edit a document's title and/or tags. */
  update(id: string, input: { title?: string; tags?: string[] }): Observable<KnowledgeDoc> {
    return this.api.patch<KnowledgeDoc>(`/knowledge/documents/${id}`, input);
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

  /** Server-side Q&A history (so the Hub transcript follows the learner across devices). */
  listQa(): Observable<QaTurn[]> {
    return this.api.get<QaTurn[]>('/knowledge/qa');
  }
  saveQa(input: { question: string; answer: string; sources?: unknown[]; confidence?: number }): Observable<QaTurn> {
    return this.api.post<QaTurn>('/knowledge/qa', input);
  }
  clearQa(): Observable<{ deleted: number }> {
    return this.api.delete<{ deleted: number }>('/knowledge/qa');
  }

  private unwrap<T>(res: ApiResponse<T>): T {
    if (res.success) return res.data;
    throw new Error(res.error.message);
  }
}
