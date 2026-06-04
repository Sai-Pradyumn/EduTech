import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AttemptView,
  GenerateQuizRequest,
  QuizAnswer,
  QuizStats,
  QuizSummary,
  SubmitResult,
  TakeQuiz,
} from '../models';

/** Quiz Studio API: generate adaptive quizzes, take them, submit for graded feedback. */
@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly api = inject(ApiService);

  generate(req: GenerateQuizRequest): Observable<TakeQuiz> {
    return this.api.post<TakeQuiz>('/assessment/quizzes', req);
  }

  list(): Observable<QuizSummary[]> {
    return this.api.get<QuizSummary[]>('/assessment/quizzes');
  }

  take(id: string): Observable<TakeQuiz> {
    return this.api.get<TakeQuiz>(`/assessment/quizzes/${id}`);
  }

  submit(id: string, answers: QuizAnswer[], durationMs?: number): Observable<SubmitResult> {
    return this.api.post<SubmitResult>(`/assessment/quizzes/${id}/attempts`, { answers, durationMs });
  }

  attempts(): Observable<AttemptView[]> {
    return this.api.get<AttemptView[]>('/assessment/attempts');
  }

  /** Attempts for one quiz, newest first (per-quiz trend). */
  attemptsForQuiz(id: string): Observable<AttemptView[]> {
    return this.api.get<AttemptView[]>(`/assessment/quizzes/${id}/attempts`);
  }

  stats(): Observable<QuizStats> {
    return this.api.get<QuizStats>('/assessment/stats');
  }
}
