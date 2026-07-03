import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NetworkStatusService } from '../../core/services/network-status.service';

/**
 * Inline "you're offline" banner (PWA/offline backlog). Renders only while the
 * browser is offline, so it can sit unconditionally at the top of any data-backed
 * screen: when a fetch can't reach the API the learner sees an honest, friendly
 * reason instead of an empty spinner or a raw error. Anything saved for offline
 * (SW cache) still works, and queued changes sync on reconnect.
 */
@Component({
  selector: 'asta-offline-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!net.online()) {
      <div class="offline" role="status">
        <span class="dot" aria-hidden="true"></span>
        <span>
          <b>You're offline.</b>
          {{ context() || 'New data will not load until you reconnect' }} — anything
          saved for offline is still here, and your changes sync when you're back.
        </span>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .offline {
        display: flex; align-items: flex-start; gap: 10px;
        margin: 0 0 16px; padding: 11px 14px; border-radius: 12px;
        font-size: 13px; line-height: 1.5; color: var(--text-soft);
        background: color-mix(in oklch, var(--coral, #e07856) 12%, var(--paper-2));
        border: 1px solid color-mix(in oklch, var(--coral, #e07856) 32%, var(--paper-3));
      }
      .offline b { color: var(--text); }
      .dot {
        margin-top: 5px; flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%;
        background: var(--coral, #e07856);
        animation: offlinePulse 1.8s ease-in-out infinite;
      }
      @keyframes offlinePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
    `,
  ],
})
export class OfflineNoticeComponent {
  /** Screen-specific first sentence (e.g. "The catalog can't refresh"). */
  readonly context = input('');
  readonly net = inject(NetworkStatusService);
}
