import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Asta Synapse — section header. A kicker + title + subtitle with a right-aligned
 * action slot (project `[slot=action]`/default content). Replaces ad-hoc heading rows.
 */
@Component({
  selector: 'asta-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        @if (kicker()) { <span class="syn-kicker">{{ kicker() }}</span> }
        <h2 class="t-h-app mt-1">{{ title() }}</h2>
        @if (subtitle()) { <p class="text-sm text-txt-soft mt-1.5 max-w-[64ch]">{{ subtitle() }}</p> }
      </div>
      <ng-content />
    </div>
  `,
  styles: [
    `
      .syn-kicker {
        font-family: var(--mono);
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--asta-accent);
      }
    `,
  ],
})
export class AstaSectionHeaderComponent {
  readonly kicker = input<string>('');
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
}
