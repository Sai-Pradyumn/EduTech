import { Injectable } from '@angular/core';

/** IndexedDB object stores used for offline learning (Phase 10 · M4). */
export type OfflineStore =
  | 'resources' // saved roadmaps/flows/notes/flashcards (read-only snapshots)
  | 'drafts' // quiz/project/notes drafts authored offline
  | 'syncQueue'; // queued mutations awaiting reconnect

const DB_NAME = 'asta-offline';
const DB_VERSION = 1;
const STORES: OfflineStore[] = ['resources', 'drafts', 'syncQueue'];

/**
 * Thin, promise-based IndexedDB wrapper (Phase 10 · M4). No external deps. Used by
 * OfflineService + SyncQueueService to persist larger learning data than localStorage can
 * hold. Degrades gracefully when IndexedDB is unavailable (returns empty/no-ops).
 */
@Injectable({ providedIn: 'root' })
export class LocalCacheService {
  private dbPromise?: Promise<IDBDatabase | null>;

  private open(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return this.dbPromise;
  }

  async put<T extends { id: string }>(store: OfflineStore, value: T): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await this.tx(db, store, 'readwrite', (s) => s.put(value));
  }

  async get<T>(store: OfflineStore, id: string): Promise<T | null> {
    const db = await this.open();
    if (!db) return null;
    return this.txReq<T | null>(db, store, 'readonly', (s) => s.get(id), null);
  }

  async list<T>(store: OfflineStore): Promise<T[]> {
    const db = await this.open();
    if (!db) return [];
    return this.txReq<T[]>(db, store, 'readonly', (s) => s.getAll(), []);
  }

  async delete(store: OfflineStore, id: string): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await this.tx(db, store, 'readwrite', (s) => s.delete(id));
  }

  async clear(store: OfflineStore): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await this.tx(db, store, 'readwrite', (s) => s.clear());
  }

  private tx(
    db: IDBDatabase,
    store: OfflineStore,
    mode: IDBTransactionMode,
    op: (s: IDBObjectStore) => IDBRequest,
  ): Promise<void> {
    return new Promise((resolve) => {
      const t = db.transaction(store, mode);
      op(t.objectStore(store));
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    });
  }

  private txReq<T>(
    db: IDBDatabase,
    store: OfflineStore,
    mode: IDBTransactionMode,
    op: (s: IDBObjectStore) => IDBRequest,
    fallback: T,
  ): Promise<T> {
    return new Promise((resolve) => {
      const t = db.transaction(store, mode);
      const req = op(t.objectStore(store));
      req.onsuccess = () => resolve((req.result as T) ?? fallback);
      req.onerror = () => resolve(fallback);
    });
  }
}
