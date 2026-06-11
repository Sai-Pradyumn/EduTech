import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

/** Substrings of known-benign errors we never surface or spam the console with. */
const BENIGN = ['ResizeObserver loop', 'AbortError', 'NG0100'];

/**
 * App-wide error handler: swallows known-benign noise, prompts a reload on a
 * failed lazy-chunk load (stale deploy), and otherwise logs with a tag and
 * shows one non-intrusive toast. Uses the Injector lazily so it can be created
 * before the rest of the DI graph is ready.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);
  private lastShown = 0;

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
    this.toast('Something went wrong. Please try again.', 'danger');
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
