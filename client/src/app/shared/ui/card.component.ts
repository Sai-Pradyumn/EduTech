import { ChangeDetectionStrategy, Component, ElementRef, Input, Renderer2, inject, viewChild } from '@angular/core';

/**
 * Generic surface card (DESIGN_SPEC §4.2). Depth from light, never border strips.
 * Carries a cursor-following accent spotlight (written via Renderer, so high-frequency
 * pointer moves never trigger change detection). Reduced-motion fades it instantly.
 */
@Component({
  selector: 'asta-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #card
      class="card h-full"
      [class.card-accent]="!!accentVar"
      [style.--accent-c]="accentVar"
      [style.padding]="padded ? pad : '0'"
      (pointermove)="onMove($event)"
      (pointerenter)="setSpot('1')"
      (pointerleave)="setSpot('0')"
    >
      <span class="card-spot" aria-hidden="true"></span>
      <div class="card-body"><ng-content /></div>
    </div>
  `,
})
export class CardComponent {
  @Input() padded = true;
  @Input() pad = '20px';
  /** Optional accent, e.g. 'var(--green)'. Rendered as a soft corner bloom +
   *  accent-tinted hairline + accent spotlight — never a border strip. */
  @Input() accentVar: string | null = null;

  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  private readonly r = inject(Renderer2);

  onMove(e: PointerEvent): void {
    const el = this.card().nativeElement;
    const rect = el.getBoundingClientRect();
    this.r.setStyle(el, '--mx', `${e.clientX - rect.left}px`);
    this.r.setStyle(el, '--my', `${e.clientY - rect.top}px`);
  }

  setSpot(v: '0' | '1'): void {
    this.r.setStyle(this.card().nativeElement, '--spot', v);
  }
}
