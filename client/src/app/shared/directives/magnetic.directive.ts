import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

/**
 * Magnetic hover — element drifts toward the pointer a few px (DESIGN_SPEC §7).
 * Ported from landing.js. Honors reduced-motion (no-op). Use on CTAs.
 */
@Directive({
  selector: '[astaMagnetic]',
  standalone: true,
})
export class MagneticDirective {
  /** Max travel in px. */
  @Input() strength = 6;
  private readonly el = inject(ElementRef<HTMLElement>);

  private get reduce(): boolean {
    return (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  @HostListener('pointermove', ['$event'])
  onMove(e: PointerEvent): void {
    if (this.reduce) return;
    const node = this.el.nativeElement;
    const r = node.getBoundingClientRect();
    const mx = (e.clientX - r.left - r.width / 2) / r.width;
    const my = (e.clientY - r.top - r.height / 2) / r.height;
    node.style.transform = `translate(${mx * this.strength}px, ${my * this.strength - 2}px)`;
  }

  @HostListener('pointerleave')
  onLeave(): void {
    this.el.nativeElement.style.transform = '';
  }
}
