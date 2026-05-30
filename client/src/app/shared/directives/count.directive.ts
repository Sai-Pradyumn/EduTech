import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';

/**
 * Binding-safe count-up (D2). Unlike `astaCountUp` (which takes a static `to` and
 * fights `{{ }}` interpolation), this owns the element's text and re-animates
 * whenever its numeric input changes — so it works on async-loaded signal metrics.
 * Reduced-motion → snaps to the value. Honors prefix/suffix/decimals.
 *
 * Usage: <span [astaCount]="d.totals.students"></span>
 *        <span [astaCount]="mrr" prefix="₹"></span>
 *        <span [astaCount]="latency" suffix="ms"></span>
 */
@Directive({
  selector: '[astaCount]',
  standalone: true,
})
export class CountDirective implements OnDestroy {
  /** Target value (the directive selector binds here). */
  readonly astaCount = input.required<number>();
  readonly decimals = input(0);
  readonly prefix = input('');
  readonly suffix = input('');
  readonly duration = input(1000);

  private readonly el = inject(ElementRef<HTMLElement>);
  private current = 0;
  private raf = 0;

  constructor() {
    effect(() => {
      const target = this.astaCount();
      this.animate(Number.isFinite(target) ? target : 0);
    });
  }

  private animate(to: number): void {
    cancelAnimationFrame(this.raf);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.render(to);
      this.current = to;
      return;
    }
    const from = this.current;
    const dur = this.duration();
    const t0 = performance.now();
    const tick = (t: number): void => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      this.render(from + (to - from) * eased);
      if (k < 1) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.render(to);
        this.current = to;
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private render(v: number): void {
    this.el.nativeElement.textContent = `${this.prefix()}${v.toFixed(this.decimals())}${this.suffix()}`;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }
}
