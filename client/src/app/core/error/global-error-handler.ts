import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ToastService } from '../services/toast.service';

/** Substrings of known-benign errors we never surface or spam the console with. */
const BENIGN = ['ResizeObserver loop', 'AbortError', 'NG0100'];

/** At most this many error reports leave the browser per session (dedup'd by message). */
const MAX_REPORTS = 5;

/**
 * App-wide error handler: swallows known-benign noise, prompts a reload on a
 * failed lazy-chunk load (stale deploy), logs with a tag, shows one throttled
 * toast — and beacons the error to the server ops feed (`POST /ops/client-errors`)
 * so production failures are visible in `/admin/ops`, not just the victim's
 * console. Uses the Injector lazily so it can be created before the rest of
 * the DI graph is ready.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);
  private lastShown = 0;
  private readonly reported = new Set<string>();

  handleError(error: unknown): void {
    const message = this.messageOf(error);
    if (BENIGN.some((b) => message.includes(b))) return;

    // A failed dynamic import means the user is on a stale build after a deploy.
    if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(message)) {
      this.toast('A new version is available — please reload.', 'warning');
      console.error('[asta] chunk load failed:', error);
      return;
    }

    console.error('[asta] uncaught error:', error);
    this.report(message, error);
    this.toast('Something went wrong. Please try again.', 'danger');
  }

  /** Fire-and-forget beacon to the server error feed. Deduped + capped per session;
   *  uses raw fetch (not HttpClient) so a failing interceptor chain can't loop back
   *  into this handler, and `keepalive` so reports survive navigation. */
  private report(message: string, error: unknown): void {
    if (this.reported.has(message) || this.reported.size >= MAX_REPORTS) return;
    this.reported.add(message);
    const stack = error instanceof Error && error.stack ? error.stack.slice(0, 4000) : undefined;
    try {
      void fetch(`${environment.apiBaseUrl}/ops/client-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: message.slice(0, 500),
          stack,
          url: location.pathname.slice(0, 300),
        }),
      }).catch(() => undefined);
    } catch {
      /* Reporting must never throw back into the handler. */
    }
  }

  private toast(msg: string, tone: 'warning' | 'danger'): void {
    // Throttle so a burst of errors can't stack a wall of toasts.
    const now = Date.now();
    if (now - this.lastShown < 4000) return;
    this.lastShown = now;
    try {
      this.injector.get(ToastService)[tone === 'warning' ? 'warning' : 'error'](msg);
    } catch {
      /* ToastService not ready yet — console log above is enough. */
    }
  }

  private messageOf(error: unknown): string {
    if (!error) return '';
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String((error as { message?: unknown })?.message ?? error);
  }
}
