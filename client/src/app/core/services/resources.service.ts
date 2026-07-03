import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type ResourceKind =
  | 'course'
  | 'docs'
  | 'video'
  | 'practice'
  | 'book'
  | 'article'
  | 'tool';
export type ResourceLevel = 'beginner' | 'intermediate' | 'advanced';
export type ResourceProgress = 'saved' | 'in_progress' | 'done';

export interface LearningResource {
  id: string;
  title: string;
  url: string;
  provider: string;
  kind: ResourceKind;
  topics: string[];
  level: ResourceLevel;
  minutes: number;
  free: boolean;
  description: string;
  progress: ResourceProgress | null;
  upvotes: number;
  hasUpvoted: boolean;
  /** 'pending' appears only on your own not-yet-approved suggestions. */
  status: 'approved' | 'pending';
  /** For-you only: why this was matched to the learner. */
  reason?: string;
}

export interface SuggestResourceInput {
  title: string;
  url: string;
  provider: string;
  kind: ResourceKind;
  level: ResourceLevel;
  topics: string[];
  minutes?: number;
  description?: string;
  free?: boolean;
}

/** Curated learning resources: catalog, personalized picks, personal library. */
@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private readonly api = inject(ApiService);

  list(filter: {
    q?: string;
    kind?: ResourceKind;
    level?: ResourceLevel;
    topic?: string;
  } = {}): Observable<LearningResource[]> {
    const params: Record<string, string> = {};
    if (filter.q) params['q'] = filter.q;
    if (filter.kind) params['kind'] = filter.kind;
    if (filter.level) params['level'] = filter.level;
    if (filter.topic) params['topic'] = filter.topic;
    return this.api.get<LearningResource[]>('/resources', params);
  }

  forYou(): Observable<LearningResource[]> {
    return this.api.get<LearningResource[]>('/resources/for-you');
  }

  library(): Observable<LearningResource[]> {
    return this.api.get<LearningResource[]>('/resources/library');
  }

  setProgress(
    id: string,
    status: ResourceProgress,
  ): Observable<LearningResource> {
    return this.api.put<LearningResource>(`/resources/${id}/progress`, {
      status,
    });
  }

  clearProgress(id: string): Observable<{ removed: boolean }> {
    return this.api.delete<{ removed: boolean }>(`/resources/${id}/progress`);
  }

  /** Suggest a resource for the catalog — pending until an admin approves. */
  suggest(input: SuggestResourceInput): Observable<LearningResource> {
    return this.api.post<LearningResource>('/resources/suggest', input);
  }

  /** Toggle your upvote on a resource. */
  upvote(id: string): Observable<LearningResource> {
    return this.api.post<LearningResource>(`/resources/${id}/upvote`, {});
  }
}
