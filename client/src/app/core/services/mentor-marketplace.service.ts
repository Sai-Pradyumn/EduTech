import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Mentor {
  id: string;
  name: string;
  headline: string;
  expertise: string[];
  bio: string;
  availability: string;
  pricingMode: string;
  priceNote: string;
  rating: { avg: number; count: number };
}
export interface MentorProfileInput {
  headline: string;
  expertise?: string[];
  bio?: string;
  availability?: string;
  pricingMode?: 'free' | 'paid';
  priceNote?: string;
  visibility?: 'public' | 'org';
}
export interface MentorSession {
  id: string;
  type: string;
  status: 'requested' | 'accepted' | 'completed' | 'cancelled';
  message: string;
  notes: string;
  role: 'student' | 'mentor';
  counterpartName: string;
  linkedProjectId: string | null;
  scheduledAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MentorMarketplaceService {
  private readonly api = inject(ApiService);
  list(): Observable<Mentor[]> { return this.api.get<Mentor[]>('/mentors'); }
  get(id: string): Observable<Mentor> { return this.api.get<Mentor>(`/mentors/${id}`); }
  myProfile(): Observable<MentorProfileInput | null> { return this.api.get<MentorProfileInput | null>('/mentors/profile/me'); }
  saveProfile(input: MentorProfileInput): Observable<MentorProfileInput> { return this.api.post<MentorProfileInput>('/mentors/profile', input); }
  requestSession(input: { mentorId: string; type: string; message?: string; linkedProjectId?: string }): Observable<{ id: string; status: string }> {
    return this.api.post<{ id: string; status: string }>('/mentor-sessions', input);
  }
  sessions(): Observable<MentorSession[]> { return this.api.get<MentorSession[]>('/mentor-sessions'); }
  setStatus(id: string, status: string, scheduledAt?: string): Observable<{ id: string; status: string }> {
    return this.api.patch<{ id: string; status: string }>(`/mentor-sessions/${id}/status`, scheduledAt ? { status, scheduledAt } : { status });
  }
  addNotes(id: string, notes: string): Observable<{ id: string; notes: string }> { return this.api.post<{ id: string; notes: string }>(`/mentor-sessions/${id}/notes`, { notes }); }
}
