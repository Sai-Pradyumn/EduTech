import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { GuardianVerdict } from '../models';

/** Cognitive Guardian facade — an on-demand deep review of a tutor answer. */
@Injectable({ providedIn: 'root' })
export class GuardianService {
  private readonly api = inject(ApiService);

  review(question: string, answer: string): Observable<GuardianVerdict> {
    return this.api.post<GuardianVerdict>('/guardian/review', { question, answer });
  }
}
