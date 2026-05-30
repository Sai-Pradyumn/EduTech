import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'asta-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="skeleton block"
    [style.width]="w"
    [style.height]="h"
    [style.borderRadius]="radius"
  ></span>`,
})
export class SkeletonComponent {
  @Input() w = '100%';
  @Input() h = '16px';
  @Input() radius = 'var(--r-sm)';
}
