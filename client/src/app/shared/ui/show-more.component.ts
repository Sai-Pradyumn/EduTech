import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Shared "reveal more" control for windowed lists (see `windowedList`). Renders
 * nothing when there's nothing hidden, so it can sit unconditionally after a list.
 */
@Component({
  selector: 'asta-show-more',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (remaining() > 0) {
      <button type="button" class="show-more" (click)="more.emit()">
        Show {{ step() }} more
        <span class="rem">· {{ remaining() }} hidden</span>
      </button>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .show-more {
        display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
        font-size: 12.5px; padding: 7px 14px; border-radius: 999px; cursor: pointer;
        color: var(--text-soft); background: var(--paper-2);
        border: 1px solid var(--paper-3);
        transition: color .15s var(--ease), border-color .15s var(--ease), background .15s var(--ease);
      }
      .show-more:hover { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); }
      .rem { color: var(--text-mute); font-variant-numeric: tabular-nums; }
    `,
  ],
})
export class ShowMoreComponent {
  /** Items hidden past the current window. */
  readonly remaining = input.required<number>();
  /** How many more the button reveals (label only). */
  readonly step = input(50);
  readonly more = output<void>();
}
