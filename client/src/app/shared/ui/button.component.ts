import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Pill button (DESIGN_SPEC §4.1). variant: accent | ink | ghost. */
@Component({
  selector: 'asta-btn',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [attr.aria-busy]="loading"
      class="inline-flex items-center justify-center gap-2.5 font-sans font-semibold rounded-full border-[1.5px] border-transparent cursor-pointer whitespace-nowrap select-none transition-[transform,box-shadow,background,color] duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
      [class]="sizeClass + ' ' + variantClass"
      [style.width]="full ? '100%' : null"
    >
      @if (loading) {
        <span
          class="inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"
          aria-hidden="true"
        ></span>
      }
      <ng-content />
    </button>
  `,
  styles: [
    `
      button:not(:disabled):hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      button:active {
        transform: translateY(0);
      }
    `,
  ],
})
export class ButtonComponent {
  @Input() variant: 'accent' | 'ink' | 'ghost' = 'accent';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() full = false;

  get sizeClass(): string {
    return this.size === 'sm' ? 'text-sm px-4 py-2.5' : 'text-base px-6 py-3.5';
  }

  get variantClass(): string {
    switch (this.variant) {
      case 'ink':
        return 'bg-ink text-paper';
      case 'ghost':
        return 'bg-transparent text-txt border-paper-3 hover:bg-paper-2';
      default:
        return 'bg-green text-ink';
    }
  }
}
