import { ChangeDetectionStrategy, Component, Input, output } from '@angular/core';

/**
 * Standard inline "couldn't load" state (CORE-MF-001). GET failures are deliberately not
 * globally toasted, so screens use this to surface a failed load with a retry instead of a
 * blank or silently-stale panel. Keep the last-known content elsewhere where possible; this
 * is for the "we have nothing to show and the request failed" case.
 */
@Component({
  selector: 'asta-load-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="le-wrap" role="alert">
      <span class="le-glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>
      <p class="le-title">{{ title }}</p>
      <p class="le-desc">{{ description }}</p>
      <button class="le-retry" type="button" (click)="retry.emit()">{{ retryLabel }}</button>
    </div>
  `,
  styles: [
    `
      .le-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 24px; }
      .le-glyph {
        display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; margin-bottom: 14px;
        color: var(--warn, #d19a20); background: color-mix(in oklch, var(--warn, #d19a20) 14%, transparent);
      }
      .le-title { font-family: var(--display); font-size: 17px; margin-bottom: 4px; }
      .le-desc { font-size: 13px; color: var(--text-soft); max-width: 22rem; margin-bottom: 16px; }
      .le-retry {
        border-radius: 100px; padding: 8px 18px; font-size: 13px; font-weight: 600;
        color: var(--ink); background: var(--green);
      }
      .le-retry:hover { filter: brightness(1.03); }
    `,
  ],
})
export class LoadErrorComponent {
  @Input() title = "Couldn't load this";
  @Input() description = 'There was a problem reaching the server. Check your connection and try again.';
  @Input() retryLabel = 'Retry';
  readonly retry = output<void>();
}
