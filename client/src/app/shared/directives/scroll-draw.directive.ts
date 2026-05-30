import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';

/**
 * Scroll-drawn progress (D2) — sets a `--draw` custom property (0→1) on the host
 * as it scrolls through the viewport, so a connector line/path can "draw in" as
 * you read down (e.g. the roadmap weekly-plan spine). Tracks the shell's internal
 * scroll container (`[data-asta-scroll]`) or falls back to the window. Runs
 * outside Angular; reduced-motion → instantly fully drawn.
 */
@Directive({
  selector: '[astaScrollDraw]',
  standalone: true,
})
export class ScrollDrawDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private scroller?: HTMLElement | Window;
  private onScroll?: () => void;

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.style.setProperty('--draw', '1');
      return;
    }
    const cont = document.querySelector<HTMLElement>('[data-asta-scroll]');
    this.scroller = cont ?? window;
    this.zone.runOutsideAngular(() => {
      let ticking = false;
      const apply = (): void => {
        ticking = false;
        const rect = node.getBoundingClientRect();
        const vh = cont ? cont.clientHeight : window.innerHeight;
        const vTop = cont ? cont.getBoundingClientRect().top : 0;
        const start = vTop + vh * 0.82; // begin drawing when the section enters
        const span = rect.height + vh * 0.42;
        const p = (start - rect.top) / span;
        node.style.setProperty('--draw', String(Math.max(0, Math.min(1, p))));
      };
      this.onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(apply);
      };
      apply();
      this.scroller!.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.onScroll) {
      this.scroller?.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onScroll);
    }
  }
}
