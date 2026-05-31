import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type CourseVisibility = 'private' | 'org' | 'cohort';

export interface CourseLesson { id: string; title: string; content: string; estimateMinutes: number; }
export interface CourseModule {
  id: string;
  title: string;
  summary: string;
  lessons: CourseLesson[];
  linkedQuizId: string | null;
  linkedVisualId: string | null;
  voiceScript: string;
}
export interface Course {
  id: string;
  title: string;
  goal: string;
  description: string;
  audience: string;
  level: Difficulty;
  source: string;
  status: 'draft' | 'published' | 'archived';
  visibility: CourseVisibility;
  modules: CourseModule[];
  project: { title: string; brief: string; linkedProjectId: string | null };
  certificateCriteria: string[];
  linkedFlowId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly api = inject(ApiService);

  list(): Observable<Course[]> { return this.api.get<Course[]>('/courses'); }
  get(id: string): Observable<Course> { return this.api.get<Course>(`/courses/${id}`); }
  generate(body: { goal: string; level?: Difficulty; audience?: string; outline?: string }): Observable<Course> { return this.api.post<Course>('/courses', body); }
  fromRoadmap(roadmapId: string): Observable<Course> { return this.api.post<Course>(`/courses/from-roadmap/${roadmapId}`, {}); }
  update(id: string, body: Partial<Pick<Course, 'title' | 'description' | 'audience'>> & { modules?: { id: string; title: string; summary?: string; lessons?: { id: string; title: string; content?: string }[] }[] }): Observable<Course> { return this.api.patch<Course>(`/courses/${id}`, body); }
  generateQuiz(id: string, moduleId: string): Observable<Course> { return this.api.post<Course>(`/courses/${id}/modules/${moduleId}/quiz`, {}); }
  generateVisual(id: string, moduleId: string): Observable<Course> { return this.api.post<Course>(`/courses/${id}/modules/${moduleId}/visual`, {}); }
  generateProject(id: string): Observable<Course> { return this.api.post<Course>(`/courses/${id}/project`, {}); }
  generateFlow(id: string): Observable<{ course: Course; flowId: string }> { return this.api.post(`/courses/${id}/flow`, {}); }
  publish(id: string, visibility: CourseVisibility): Observable<Course> { return this.api.post<Course>(`/courses/${id}/publish`, { visibility }); }
  remove(id: string): Observable<{ ok: true }> { return this.api.delete<{ ok: true }>(`/courses/${id}`); }
}
