import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, inject } from '@angular/core';

/**
 * Scroll parallax — translates the element vertically as the page scrolls, by a
 * depth factor (negative moves opposite to scroll). Great for ambient background
 * layers and hero accents. Runs outside Angular, honors reduced-motion (no-op).
 *
 * By default it reacts to window scroll. When the app shell scrolls its content
 * in an internal container (the A2 scroll-split shell), pass a CSS selector via
 * `astaParallaxScroll` so the parallax tracks that element's `scrollTop` instead.
 *
 * Usage:
 *   <div [astaParallax]="0.12"></div>                              // window scroll
 *   <div [astaParallax]="0.12" astaParallaxScroll="[data-scroll]"></div>  // container scroll
 */
@Directive({
  selector: '[astaParallax]',
  standalone: true,
})
export class ParallaxDirective implements AfterViewInit, OnDestroy {
  /** Depth factor; element shifts by `scroll * depth` px. */
  @Input('astaParallax') depth = 0.1;
  /** Optional CSS selector for the scroll container to track (defaults to window). */
  @Input() astaParallaxScroll?: string;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private onScroll?: () => void;
  private target?: EventTarget;

  ngAfterViewInit(): void {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.zone.runOutsideAngular(() => {
      const container = this.astaParallaxScroll
        ? document.querySelector<HTMLElement>(this.astaParallaxScroll)
        : null;
      this.target = container ?? window;
      const scrollTop = () => (container ? container.scrollTop : window.scrollY);
      let ticking = false;
      const apply = () => {
        ticking = false;
        this.el.nativeElement.style.transform = `translate3d(0, ${scrollTop() * this.depth}px, 0)`;
      };
      this.onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(apply);
      };
      apply();
      this.target.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.onScroll) this.target?.removeEventListener('scroll', this.onScroll);
  }
}
