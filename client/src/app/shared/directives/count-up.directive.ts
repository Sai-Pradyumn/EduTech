import { AfterViewInit, Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';

/**
 * Count-up animation on first view (DESIGN_SPEC §7). Ported from landing.js.
 * Usage: <b astaCountUp [to]="93">0</b>  — animates 0→93 with ease-out cubic.
 */
@Directive({
  selector: '[astaCountUp]',
  standalone: true,
})
export class CountUpDirective implements AfterViewInit, OnDestroy {
  @Input({ required: true }) to = 0;
  @Input() duration = 1400;

  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    const reduce =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      node.textContent = this.to.toString();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          this.run(node);
          this.observer?.unobserve(node);
        }
      },
      { threshold: 0.6 },
    );
    this.observer.observe(node);
  }

  private run(node: HTMLElement): void {
    const t0 = performance.now();
    const tick = (t: number): void => {
      const k = Math.min(1, (t - t0) / this.duration);
      const eased = 1 - Math.pow(1 - k, 3);
      node.textContent = Math.round(this.to * eased).toString();
      if (k < 1) requestAnimationFrame(tick);
      else node.textContent = this.to.toString();
    };
    requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
