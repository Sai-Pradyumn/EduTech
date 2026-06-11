import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Form field wrapper: label + projected control + helper/error (DESIGN_SPEC §4.2).
 *  The label warms toward the accent while its control is focused; errors slide in
 *  with a gentle shake so validation feedback is felt, not just read. */
@Component({
  selector: 'asta-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -- control is projected via <ng-content>, so it is implicitly associated by nesting -->
    <label class="fld block mb-4">
      @if (label) {
        <span class="fld-label block mb-1.5 text-sm font-medium text-txt-soft">{{ label }}</span>
      }
      <ng-content />
      @if (error) {
        <span class="fld-error block mt-1.5 text-[13px] text-[var(--danger)]" role="alert">{{ error }}</span>
      } @else if (hint) {
        <span class="block mt-1.5 text-[13px] text-txt-mute">{{ hint }}</span>
      }
    </label>
  `,
  styles: [
    `
      .fld-label { transition: color 0.2s var(--ease); }
      .fld:focus-within .fld-label { color: var(--green-deep); }
      .fld-error { animation: fldShake 0.35s var(--ease); }
      @keyframes fldShake {
        0% { opacity: 0; transform: translateX(0); }
        25% { transform: translateX(-3px); }
        50% { transform: translateX(3px); }
        75% { transform: translateX(-2px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .fld-error { animation: none; }
      }
    `,
  ],
})
export class FieldComponent {
  @Input() label = '';
  @Input() hint = '';
  @Input() error: string | null = null;
}
