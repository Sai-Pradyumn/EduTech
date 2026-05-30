import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

/**
 * 3D pointer tilt — the element rotates toward the pointer for a tactile,
 * "lifts off the page" feel. Honors reduced-motion (no-op). Sets perspective on
 * the element itself so it works standalone.
 *
 * Usage: <article astaTilt [tiltMax]="8">…</article>
 */
@Directive({
  selector: '[astaTilt]',
  standalone: true,
  host: { style: 'transform-style: preserve-3d;' },
})
export class TiltDirective {
  /** Max rotation in degrees. */
  @Input() tiltMax = 7;
  private readonly el = inject(ElementRef<HTMLElement>);

  private get reduce(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  @HostListener('pointermove', ['$event'])
  onMove(e: PointerEvent): void {
    if (this.reduce) return;
    const node = this.el.nativeElement;
    const r = node.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    node.style.transform = `perspective(800px) rotateX(${-py * this.tiltMax}deg) rotateY(${px * this.tiltMax}deg) translateZ(0)`;
  }

  @HostListener('pointerleave')
  onLeave(): void {
    this.el.nativeElement.style.transform = '';
  }
}
