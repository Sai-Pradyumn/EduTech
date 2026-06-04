import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SESSION_MODES } from './asta-os.constants';
import { AstaSessionMode } from './asta-os.types';

/** Chat | Voice | Face segmented selector for the active session surface. */
@Component({
  selector: 'asta-os-session-mode-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" role="group" aria-label="Session mode">
      @for (m of modes; track m.mode) {
        <button
          type="button"
          class="seg-btn"
          [class.active]="active() === m.mode"
          [attr.aria-pressed]="active() === m.mode"
          (click)="change.emit(m.mode)"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path [attr.d]="m.icon" />
          </svg>
          <span>{{ m.label }}</span>
        </button>
      }
    </div>
  `,
  styles: [
    `
      .seg {
        display: inline-flex;
        gap: 2px;
        padding: 3px;
        border-radius: 12px;
        background: var(--asta-panel);
        border: 1px solid var(--asta-border);
      }
      .seg-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: 10px;
        color: var(--asta-muted);
        transition: color .18s ease, background .18s ease, box-shadow .25s ease;
      }
      .seg-btn:hover { color: var(--asta-text); }
      .seg-btn.active {
        color: #06100a;
        background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep));
        box-shadow: 0 0 14px color-mix(in srgb, var(--asta-green) 45%, transparent);
      }
    `,
  ],
})
export class AstaOsSessionModeToggleComponent {
  readonly active = input.required<AstaSessionMode>();
  readonly change = output<AstaSessionMode>();
  protected readonly modes = SESSION_MODES;
}
