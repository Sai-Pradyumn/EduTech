import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ToastTone } from '../../core/models';

/** Status badge: low-alpha tinted bg + -deep text (DESIGN_SPEC §4.1). */
@Component({
  selector: 'asta-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-mono uppercase tracking-wider"
      [style.background]="bg"
      [style.color]="fg"
    >
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  @Input() tone: ToastTone = 'success';

  private hue(): number {
    return { success: 150, info: 268, warning: 38, danger: 25 }[this.tone];
  }
  get bg(): string {
    return `oklch(0.8 0.16 ${this.hue()} / .14)`;
  }
  get fg(): string {
    return `oklch(0.5 0.16 ${this.hue()})`;
  }
}
