import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AdminAnalytics,
  AdminDocumentRow,
  AdminQuizRow,
  AdminRoadmapRow,
  AdminStudentRow,
} from '../models';

/** Admin Command Center API (Phase 3 · A7) — Role.Admin only. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  analytics(): Observable<AdminAnalytics> {
    return this.api.get<AdminAnalytics>('/admin/analytics');
  }

  students(): Observable<AdminStudentRow[]> {
    return this.api.get<AdminStudentRow[]>('/admin/students');
  }

  documents(): Observable<AdminDocumentRow[]> {
    return this.api.get<AdminDocumentRow[]>('/admin/documents');
  }

  roadmaps(): Observable<AdminRoadmapRow[]> {
    return this.api.get<AdminRoadmapRow[]>('/admin/roadmaps');
  }

  assessments(): Observable<AdminQuizRow[]> {
    return this.api.get<AdminQuizRow[]>('/admin/assessments');
  }
}
