import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

/** In-app notifications (B13). Holds a small reactive cache for the topbar bell. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);

  readonly items = signal<NotificationView[]>([]);
  readonly unread = signal(0);

  load(): void {
    this.api.get<{ items: NotificationView[]; unread: number }>('/notifications').subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.unread.set(res.unread);
      },
    });
  }

  /** Fetch a page of notifications without touching the bell's cache (used by the history page). */
  fetch(limit = 30): Observable<{ items: NotificationView[]; unread: number }> {
    return this.api.get<{ items: NotificationView[]; unread: number }>('/notifications', { limit });
  }

  markRead(id: string): void {
    this.api.post(`/notifications/${id}/read`, {}).subscribe({
      next: () => {
        this.items.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
        this.unread.update((u) => Math.max(0, u - 1));
      },
    });
  }

  markAllRead(): void {
    this.api.post('/notifications/read-all', {}).subscribe({
      next: () => {
        this.items.update((list) => list.map((n) => ({ ...n, read: true })));
        this.unread.set(0);
      },
    });
  }
}
