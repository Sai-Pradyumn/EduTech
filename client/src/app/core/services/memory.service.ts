import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AstaMemorySuggestion, LearnerMemory, MemoryDecision } from '../models';

/** One row of "what Asta knows about me", across both memory stores. */
export interface MemoryEntry {
  id: string;
  /** confirmed = you approved it; observed = agents noted it from your activity. */
  source: 'confirmed' | 'observed';
  kind: string;
  text: string;
  when: string | null;
}

/** Learner-memory facade: list saved memories and confirm (save/dismiss) suggestions. */
@Injectable({ providedIn: 'root' })
export class MemoryService {
  private readonly api = inject(ApiService);

  list(): Observable<LearnerMemory[]> {
    return this.api.get<LearnerMemory[]>('/memory');
  }

  /** The memory manager: everything Asta remembers, across both stores. */
  listAll(): Observable<MemoryEntry[]> {
    return this.api.get<MemoryEntry[]>('/memory/all');
  }

  remove(entry: MemoryEntry): Observable<void> {
    return entry.source === 'observed'
      ? this.api.delete<void>(`/memory/observed/${entry.id}`)
      : this.api.delete<void>(`/memory/${entry.id}`);
  }

  /** Persist or dismiss a suggested memory (server records an audit entry either way). */
  confirm(suggestion: AstaMemorySuggestion, decision: MemoryDecision): Observable<LearnerMemory | null> {
    return this.api.post<LearnerMemory | null>('/memory/confirm', {
      type: suggestion.type,
      value: suggestion.value,
      summary: suggestion.summary,
      decision,
    });
  }
}
