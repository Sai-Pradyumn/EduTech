import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Confirmation sheet for sensitive/destructive voice intents. Voice never
 * executes these directly — the user must explicitly confirm, after which the
 * orchestrator only routes them to the relevant screen to act safely.
 */
@Component({
  selector: 'asta-voice-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="confirm">
      <span class="warn-glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" />
        </svg>
      </span>
      <p class="ctitle">Confirm sensitive action</p>
      <p class="cbody">{{ message }}</p>
      <div class="actions">
        <button class="btn ghost pressable" (click)="cancel.emit()">Cancel</button>
        <button class="btn solid pressable" (click)="confirm.emit()">Continue safely</button>
      </div>
    </div>
  `,
  styles: [
    `
      .confirm { text-align: center; max-width: 340px; }
      .warn-glyph {
        display: inline-grid; place-items: center; width: 44px; height: 44px; margin-bottom: 10px;
        border-radius: 50%; color: var(--coral-deep);
        background: color-mix(in oklch, var(--coral) 16%, transparent);
      }
      .ctitle { font-family: var(--display); font-size: 18px; margin-bottom: 6px; color: var(--text); }
      .cbody { font-size: 14px; color: var(--text-soft); line-height: 1.55; margin-bottom: 16px; }
      .actions { display: flex; gap: 10px; justify-content: center; }
      .btn { font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 100px; cursor: pointer; border: 1px solid transparent; }
      .btn.ghost { background: transparent; border-color: var(--paper-3); color: var(--text-soft); }
      .btn.ghost:hover { color: var(--text); border-color: var(--text-mute); }
      .btn.solid { background: var(--ink); color: var(--on-ink); }
    `,
  ],
})
export class VoiceCommandConfirmComponent {
  @Input() message = 'This is a sensitive change.';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
