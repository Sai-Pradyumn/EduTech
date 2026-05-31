import { Injectable, inject, signal } from '@angular/core';
import { LocalCacheService } from './local-cache.service';

export type OfflineResourceKind =
  | 'roadmap'
  | 'flow'
  | 'notes'
  | 'flashcards'
  | 'space';

export interface OfflineResource {
  id: string; // `${kind}:${refId}`
  kind: OfflineResourceKind;
  refId: string;
  title: string;
  payload: unknown;
  savedAt: string;
}

export interface OfflineDraft {
  id: string; // `${kind}:${refId}`
  kind: 'quiz' | 'project' | 'notes';
  refId: string;
  title: string;
  data: unknown;
  updatedAt: string;
}

/**
 * Offline learning store (Phase 10 · M4). Lets a learner mark roadmaps/flows/notes/
 * flashcards "available offline" and keep quiz/project/notes drafts locally — all in
 * IndexedDB. Reactive counts power the offline page + status pill.
 */
@Injectable({ providedIn: 'root' })
export class OfflineService {
  private readonly cache = inject(LocalCacheService);

  readonly resourceCount = signal(0);
  readonly draftCount = signal(0);

  async refresh(): Promise<void> {
    const [res, drafts] = await Promise.all([
      this.cache.list<OfflineResource>('resources'),
      this.cache.list<OfflineDraft>('drafts'),
    ]);
    this.resourceCount.set(res.length);
    this.draftCount.set(drafts.length);
  }

  // ── resources ──
  async saveResource(
    kind: OfflineResourceKind,
    refId: string,
    title: string,
    payload: unknown,
  ): Promise<void> {
    await this.cache.put<OfflineResource>('resources', {
      id: `${kind}:${refId}`,
      kind,
      refId,
      title,
      payload,
      savedAt: new Date().toISOString(),
    });
    await this.refresh();
  }

  listResources(): Promise<OfflineResource[]> {
    return this.cache.list<OfflineResource>('resources');
  }

  getResource(kind: OfflineResourceKind, refId: string): Promise<OfflineResource | null> {
    return this.cache.get<OfflineResource>('resources', `${kind}:${refId}`);
  }

  async isSaved(kind: OfflineResourceKind, refId: string): Promise<boolean> {
    return !!(await this.getResource(kind, refId));
  }

  async removeResource(id: string): Promise<void> {
    await this.cache.delete('resources', id);
    await this.refresh();
  }

  // ── drafts ──
  async saveDraft(
    kind: OfflineDraft['kind'],
    refId: string,
    title: string,
    data: unknown,
  ): Promise<void> {
    await this.cache.put<OfflineDraft>('drafts', {
      id: `${kind}:${refId}`,
      kind,
      refId,
      title,
      data,
      updatedAt: new Date().toISOString(),
    });
    await this.refresh();
  }

  listDrafts(): Promise<OfflineDraft[]> {
    return this.cache.list<OfflineDraft>('drafts');
  }

  getDraft(kind: OfflineDraft['kind'], refId: string): Promise<OfflineDraft | null> {
    return this.cache.get<OfflineDraft>('drafts', `${kind}:${refId}`);
  }

  async removeDraft(id: string): Promise<void> {
    await this.cache.delete('drafts', id);
    await this.refresh();
  }
}
