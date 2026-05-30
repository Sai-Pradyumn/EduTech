import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { MentorDashboard, MentorNote, MentorProfile, StudentDetail } from '../models';

/** Mentor ecosystem API (B2). */
@Injectable({ providedIn: 'root' })
export class MentorService {
  private readonly api = inject(ApiService);

  dashboard(): Observable<MentorDashboard> {
    return this.api.get<MentorDashboard>('/mentor/dashboard');
  }

  student(id: string): Observable<StudentDetail> {
    return this.api.get<StudentDetail>(`/mentor/students/${id}`);
  }

  addNote(id: string, content: string): Observable<MentorNote> {
    return this.api.post<MentorNote>(`/mentor/students/${id}/notes`, { content });
  }

  reviewProject(
    projectId: string,
    decision: 'approved' | 'changes_requested',
    feedback: string,
    score?: number,
  ): Observable<{ ok: boolean; decision: string }> {
    return this.api.post(`/mentor/projects/${projectId}/review`, { decision, feedback, score });
  }

  getProfile(): Observable<MentorProfile | null> {
    return this.api.get<MentorProfile | null>('/mentor/profile');
  }

  saveProfile(profile: Partial<MentorProfile>): Observable<MentorProfile> {
    return this.api.put<MentorProfile>('/mentor/profile', profile);
  }
}
