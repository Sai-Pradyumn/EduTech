import { Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

/**
 * `[astaRouteTransition]` — replays a short fade/slide-up enter animation on the host every
 * time navigation completes. Dependency-free (no @angular/animations): on NavigationEnd it
 * removes the animation class, forces a reflow, and re-adds it to restart the keyframe.
 * Honors `prefers-reduced-motion` (no-op). Apply to the routed content container.
 */
@Directive({
  selector: '[astaRouteTransition]',
  standalone: true,
})
export class RouteTransitionDirective implements OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly sub: Subscription;
  private readonly reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.play());
  }

  private play(): void {
    if (this.reduced) return;
    const el = this.host.nativeElement;
    this.zone.runOutsideAngular(() => {
      el.classList.remove('route-enter');
      // Force reflow so removing + re-adding the class restarts the animation.
      void el.offsetWidth;
      el.classList.add('route-enter');
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
