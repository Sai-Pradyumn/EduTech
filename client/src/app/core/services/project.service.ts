import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { GenerateProjectRequest, Project, ProjectStats, SubmitProjectRequest, TaskStatus } from '../models';

/** Project Studio API: generate a blueprint, work the Kanban board, submit. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly api = inject(ApiService);

  generate(req: GenerateProjectRequest): Observable<Project> {
    return this.api.post<Project>('/projects', req);
  }

  list(): Observable<Project[]> {
    return this.api.get<Project[]>('/projects');
  }

  get(id: string): Observable<Project> {
    return this.api.get<Project>(`/projects/${id}`);
  }

  moveTask(id: string, taskId: string, status: TaskStatus): Observable<Project> {
    return this.api.patch<Project>(`/projects/${id}/tasks/${taskId}`, { status });
  }
  reorderTask(id: string, taskId: string, direction: 'up' | 'down'): Observable<Project> {
    return this.api.patch<Project>(`/projects/${id}/tasks/${taskId}/reorder`, { direction });
  }
  setArchived(id: string, archived: boolean): Observable<Project> {
    return this.api.patch<Project>(`/projects/${id}/archive`, { archived });
  }

  addTask(id: string, title: string, phase?: string): Observable<Project> {
    return this.api.post<Project>(`/projects/${id}/tasks`, { title, phase });
  }

  removeTask(id: string, taskId: string): Observable<Project> {
    return this.api.delete<Project>(`/projects/${id}/tasks/${taskId}`);
  }

  submit(id: string, req: SubmitProjectRequest): Observable<Project> {
    return this.api.post<Project>(`/projects/${id}/submit`, req);
  }

  /** (Re)request the AI review for a submitted project (Phase 4 · B8). */
  requestAiReview(id: string): Observable<Project> {
    return this.api.post<Project>(`/projects/${id}/ai-review`, {});
  }

  toggleImprovement(id: string, itemId: string, done: boolean): Observable<Project> {
    return this.api.patch<Project>(`/projects/${id}/ai-review/items/${itemId}`, { done });
  }

  /** Generate the portfolio-ready case study for a (submitted) project. */
  generateCaseStudy(id: string): Observable<Project> {
    return this.api.post<Project>(`/projects/${id}/generate-case-study`, {});
  }

  /** Aggregate counts across all projects. */
  stats(): Observable<ProjectStats> {
    return this.api.get<ProjectStats>('/projects/stats');
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/projects/${id}`);
  }
}
