import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

/**
 * Theme toggle — a compact icon button that cycles system → light → dark.
 * Shows the icon of the current *mode* (auto/sun/moon). Token-styled, works on
 * light and dark surfaces.
 */
@Component({
  selector: 'asta-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="theme-toggle"
      (click)="theme.cycle()"
      [attr.aria-label]="'Theme: ' + theme.mode() + ' (click to change)'"
      [title]="'Theme: ' + theme.mode()"
    >
      @switch (theme.mode()) {
        @case ('light') {
          <!-- sun -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        }
        @case ('dark') {
          <!-- moon -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        }
        @default {
          <!-- system / auto -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" />
          </svg>
        }
      }
    </button>
  `,
  styles: [
    `
      .theme-toggle {
        display: inline-grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 100px;
        border: 1px solid var(--paper-3);
        background: var(--paper);
        color: var(--text-soft);
        cursor: pointer;
        transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background 0.2s var(--ease), transform 0.3s var(--ease-spring);
      }
      .theme-toggle:hover {
        color: var(--green-deep);
        border-color: var(--green);
        transform: translateY(-1px);
      }
    `,
  ],
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
