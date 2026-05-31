import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Resume {
  headline: string;
  summary: string;
  skills: string[];
  highlights: string[];
  projects: { title: string; bullets: string[] }[];
  generatedAt: string | null;
}
export interface JdMatch {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  tailoredSummary: string;
  coverLetter: string;
  prepPlan: string;
}
export interface Application {
  id: string;
  company: string;
  role: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  tailoredSummary: string;
  coverLetter: string;
  prepPlan: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';
  notes: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ResumeService {
  private readonly api = inject(ApiService);
  me(): Observable<Resume> { return this.api.get<Resume>('/resume/me'); }
  patch(input: Partial<Resume>): Observable<Resume> { return this.api.patch<Resume>('/resume/me', input); }
  generate(): Observable<Resume> { return this.api.post<Resume>('/resume/generate'); }
}

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly api = inject(ApiService);
  analyze(input: { company: string; role: string; jdText: string }): Observable<JdMatch> { return this.api.post<JdMatch>('/applications/analyze-jd', input); }
  create(input: { company: string; role: string; jdText: string }): Observable<Application> { return this.api.post<Application>('/applications', input); }
  list(): Observable<Application[]> { return this.api.get<Application[]>('/applications'); }
  update(id: string, input: { status?: string; notes?: string }): Observable<Application> { return this.api.patch<Application>(`/applications/${id}`, input); }
  remove(id: string): Observable<{ ok: true }> { return this.api.delete<{ ok: true }>(`/applications/${id}`); }
}
