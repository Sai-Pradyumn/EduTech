import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AstaMemorySuggestion, LearnerMemory, MemoryDecision } from '../models';

/** Learner-memory facade: list saved memories and confirm (save/dismiss) suggestions. */
@Injectable({ providedIn: 'root' })
export class MemoryService {
  private readonly api = inject(ApiService);

  list(): Observable<LearnerMemory[]> {
    return this.api.get<LearnerMemory[]>('/memory');
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
