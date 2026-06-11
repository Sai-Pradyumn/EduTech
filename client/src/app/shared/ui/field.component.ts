import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Form field wrapper: label + projected control + helper/error (DESIGN_SPEC §4.2). */
@Component({
  selector: 'asta-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -- control is projected via <ng-content>, so it is implicitly associated by nesting -->
    <label class="block mb-4">
      @if (label) {
        <span class="block mb-1.5 text-sm font-medium text-txt-soft">{{ label }}</span>
      }
      <ng-content />
      @if (error) {
        <span class="block mt-1.5 text-[13px] text-[var(--danger)]" role="alert">{{ error }}</span>
      } @else if (hint) {
        <span class="block mt-1.5 text-[13px] text-txt-mute">{{ hint }}</span>
      }
    </label>
  `,
})
export class FieldComponent {
  @Input() label = '';
  @Input() hint = '';
  @Input() error: string | null = null;
}
