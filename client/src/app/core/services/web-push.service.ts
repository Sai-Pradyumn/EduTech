import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

/**
 * Web Push foundation (Phase 10 · M4). Behind the ENABLE_WEB_PUSH flag. Requests
 * Notification permission, subscribes via the service worker's PushManager and registers
 * the subscription server-side. No-ops gracefully when unsupported or unconfigured.
 */
@Injectable({ providedIn: 'root' })
export class WebPushService {
  private readonly api = inject(ApiService);
  readonly permission = signal<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  readonly subscribed = signal(false);

  get supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      typeof Notification !== 'undefined'
    );
  }

  /** Prompt + subscribe. Returns false (and does nothing harmful) when not possible. */
  async enable(): Promise<boolean> {
    if (!this.supported) return false;
    const { key, configured } = await firstValueFrom(
      this.api.get<{ key: string; configured: boolean }>('/push/vapid-public-key'),
    );
    if (!configured || !key) {
      // Foundation present but no VAPID key configured — record permission only.
      const perm = await Notification.requestPermission();
      this.permission.set(perm);
      return false;
    }
    const perm = await Notification.requestPermission();
    this.permission.set(perm);
    if (perm !== 'granted') return false;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(key),
    });
    const json = sub.toJSON();
    await firstValueFrom(
      this.api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
    );
    this.subscribed.set(true);
    return true;
  }

  private urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
}
