import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Asta wordmark + the "path" logo SVG (DESIGN_SPEC §1, reused verbatim). */
@Component({
  selector: 'asta-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="flex items-center gap-2.5 select-none" [class.text-onink]="onDark">
      <svg viewBox="0 0 28 28" [attr.width]="size" [attr.height]="size" aria-hidden="true">
        <path
          d="M4 24 C4 13, 13 4, 24 4"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        />
        <circle cx="4" cy="24" r="3.4" fill="currentColor" />
        <circle cx="24" cy="4" r="3.4" fill="var(--green)" />
      </svg>
      @if (showWord) {
        <span class="font-display font-semibold tracking-tight" [style.fontSize.px]="size - 6">
          Asta
        </span>
      }
    </span>
  `,
})
export class LogoComponent {
  @Input() size = 28;
  @Input() showWord = true;
  @Input() onDark = false;
}
