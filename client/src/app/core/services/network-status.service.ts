import { Injectable, NgZone, signal } from '@angular/core';

/**
 * Network status (Phase 10 · M4). A reactive `online` signal driven by the browser's
 * online/offline events. Everything offline-aware (the status pill, sync queue, offline
 * page) reads this.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly _online = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  readonly online = this._online.asReadonly();

  constructor(private readonly zone: NgZone) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () =>
        this.zone.run(() => this._online.set(true)),
      );
      window.addEventListener('offline', () =>
        this.zone.run(() => this._online.set(false)),
      );
    }
  }

  isOnline(): boolean {
    return this._online();
  }
}
