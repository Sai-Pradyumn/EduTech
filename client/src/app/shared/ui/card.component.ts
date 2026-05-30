import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Generic surface card (DESIGN_SPEC §4.2). */
@Component({
  selector: 'asta-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="card h-full"
      [style.padding]="padded ? pad : '0'"
      [style.borderLeft]="accentVar ? '2px solid ' + accentVar : null"
    >
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  @Input() padded = true;
  @Input() pad = '20px';
  /** Optional left accent rule, e.g. 'var(--green)'. */
  @Input() accentVar: string | null = null;
}
