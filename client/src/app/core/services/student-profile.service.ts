import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { CreateStudentProfilePayload, StudentProfile } from '../models';

@Injectable({ providedIn: 'root' })
export class StudentProfileService {
  private readonly api = inject(ApiService);

  /** Cached profile signal; populated by getMine(). */
  readonly profile = signal<StudentProfile | null>(null);

  getMine(): Observable<StudentProfile | null> {
    return this.api
      .get<StudentProfile | null>('/student-profile/me')
      .pipe(tap((p) => this.profile.set(p)));
  }

  getOnboardingStatus(): Observable<{ onboardingCompleted: boolean }> {
    return this.api.get<{ onboardingCompleted: boolean }>('/student-profile/onboarding-status');
  }

  create(payload: CreateStudentProfilePayload): Observable<StudentProfile> {
    return this.api.post<StudentProfile>('/student-profile', payload).pipe(tap((p) => this.profile.set(p)));
  }

  update(payload: Partial<CreateStudentProfilePayload>): Observable<StudentProfile> {
    return this.api
      .patch<StudentProfile>('/student-profile/me', payload)
      .pipe(tap((p) => this.profile.set(p)));
  }
}
