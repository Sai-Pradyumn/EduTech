import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LocalCacheService } from './local-cache.service';
import { NetworkStatusService } from './network-status.service';

export interface QueuedAction {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string; // relative API path, e.g. '/projects/123/notes'
  body?: unknown;
  label: string; // human description for the sync drawer
  queuedAt: string;
  attempts: number;
}

/**
 * Offline mutation queue (Phase 10 · M4). When the learner acts while offline, the action
 * is persisted to IndexedDB and replayed in order on reconnect. Reads use cached data; only
 * safe, idempotent-ish mutations should be enqueued. Never queues AI generation / payments.
 */
@Injectable({ providedIn: 'root' })
export class SyncQueueService {
  private readonly cache = inject(LocalCacheService);
  private readonly net = inject(NetworkStatusService);
  private readonly base = environment.apiBaseUrl;

  readonly pending = signal<QueuedAction[]>([]);
  readonly pendingCount = computed(() => this.pending().length);
  readonly syncing = signal(false);

  constructor() {
    void this.load();
    // Auto-flush whenever we come back online.
    effect(() => {
      if (this.net.online() && this.pending().length) void this.flush();
    });
  }

  private async load(): Promise<void> {
    const items = await this.cache.list<QueuedAction>('syncQueue');
    this.pending.set(items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt)));
  }

  async enqueue(action: Omit<QueuedAction, 'id' | 'queuedAt' | 'attempts'>): Promise<void> {
    const item: QueuedAction = {
      ...action,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    };
    await this.cache.put('syncQueue', item);
    await this.load();
    if (this.net.online()) void this.flush();
  }

  /** Replay queued actions oldest-first. Stops on the first hard failure. */
  async flush(): Promise<void> {
    if (this.syncing() || !this.net.online()) return;
    this.syncing.set(true);
    try {
      for (const item of [...this.pending()]) {
        const ok = await this.send(item);
        if (ok) {
          await this.cache.delete('syncQueue', item.id);
        } else {
          item.attempts += 1;
          await this.cache.put('syncQueue', item);
          if (item.attempts < 5) break; // transient — retry later
          await this.cache.delete('syncQueue', item.id); // give up after 5
        }
      }
      await this.load();
    } finally {
      this.syncing.set(false);
    }
  }

  async clear(): Promise<void> {
    await this.cache.clear('syncQueue');
    this.pending.set([]);
  }

  private async send(item: QueuedAction): Promise<boolean> {
    try {
      const token = localStorage.getItem('asta.accessToken');
      const res = await fetch(`${this.base}${item.path}`, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
