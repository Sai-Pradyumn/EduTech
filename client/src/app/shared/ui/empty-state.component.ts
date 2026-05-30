import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Friendly empty state — glyph + title + line + projected action (DESIGN_SPEC §8). */
@Component({
  selector: 'asta-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center text-center py-12 px-6">
      <span
        class="grid place-items-center mb-5 rounded-2xl"
        style="width:56px;height:56px;background:oklch(0.80 0.16 150 / .14)"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
          stroke="var(--green-deep)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 20 C4 11, 11 4, 20 4" />
          <circle cx="4" cy="20" r="1.6" fill="var(--green-deep)" />
          <circle cx="20" cy="4" r="1.6" fill="var(--green-deep)" />
        </svg>
      </span>
      <h3 class="text-xl mb-1.5">{{ title }}</h3>
      @if (description) {
        <p class="text-txt-soft max-w-sm mb-5">{{ description }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() description = '';
}
