import { AfterViewInit, Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';

/** Reveal-on-enter via IntersectionObserver (ported from landing.js). Adds .in. */
@Directive({
  selector: '[astaReveal]',
  standalone: true,
  host: { class: 'reveal' },
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  @Input() set astaReveal(delayIndex: number | '') {
    this.delay = typeof delayIndex === 'number' ? delayIndex * 80 : 0;
  }
  private delay = 0;
  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    node.style.transitionDelay = `${this.delay}ms`;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('in');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            node.classList.add('in');
            this.observer?.unobserve(node);
          }
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
