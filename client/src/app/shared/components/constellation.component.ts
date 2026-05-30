import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  input,
  viewChild,
} from '@angular/core';

interface Node { x: number; y: number; vx: number; vy: number; }

/**
 * Asta signature backdrop — a living "learning constellation": slowly drifting
 * nodes linked by proximity lines that brighten near the pointer. Dependency-free
 * canvas, runs OUTSIDE the Angular zone (zero change detection), pauses when the
 * tab is hidden, and renders a single static frame under prefers-reduced-motion.
 * Mount behind content in a positioned (relative) container.
 */
@Component({
  selector: 'asta-constellation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv [style.opacity]="opacity()"></canvas>`,
  styles: [
    `
      :host { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
      canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    `,
  ],
})
export class ConstellationComponent implements AfterViewInit, OnDestroy {
  /** Backdrop opacity (kept subtle so it never competes with content). */
  readonly opacity = input(0.42);
  /** Link colour (R,G,B) — brand green by default. */
  readonly link = input<[number, number, number]>([99, 239, 122]);
  /** Node colour (R,G,B) — soft blue by default. */
  readonly node = input<[number, number, number]>([143, 183, 255]);

  private readonly cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone = inject(NgZone);

  private ctx: CanvasRenderingContext2D | null = null;
  private nodes: Node[] = [];
  private raf = 0;
  private ro?: ResizeObserver;
  private w = 0;
  private h = 0;
  private px = -999;
  private py = -999;
  private running = false;

  private readonly onVisibility = () => (document.hidden ? this.stop() : this.start());
  private readonly onPointer = (e: PointerEvent) => {
    const r = this.host.nativeElement.getBoundingClientRect();
    this.px = e.clientX - r.left;
    this.py = e.clientY - r.top;
  };
  private readonly onLeave = () => { this.px = -999; this.py = -999; };

  private get reduce(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  ngAfterViewInit(): void {
    const ctx = this.cv().nativeElement.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host.nativeElement);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    window.addEventListener('pointerleave', this.onLeave);
    if (this.reduce) { this.draw(); return; }
    this.start();
  }

  ngOnDestroy(): void {
    this.stop();
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('pointerleave', this.onLeave);
  }

  private resize(): void {
    const el = this.host.nativeElement;
    this.w = el.clientWidth;
    this.h = el.clientHeight;
    if (this.w === 0 || this.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = this.cv().nativeElement;
    c.width = Math.round(this.w * dpr);
    c.height = Math.round(this.h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = Math.max(14, Math.min(70, Math.round((this.w * this.h) / 24000)));
    if (this.nodes.length !== target) {
      this.nodes = Array.from({ length: target }, () => ({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
      }));
    }
    if (this.reduce) this.draw();
  }

  private start(): void {
    if (this.running || this.reduce) return;
    this.running = true;
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        this.step();
        this.draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    });
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private step(): void {
    for (const n of this.nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > this.w) n.vx *= -1;
      if (n.y < 0 || n.y > this.h) n.vy *= -1;
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    const [lr, lg, lb] = this.link();
    const [nr, ng, nb] = this.node();
    const D = 150;
    const ns = this.nodes;
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < D) {
          const al = (1 - dist / D) * 0.5;
          ctx.strokeStyle = `rgba(${lr},${lg},${lb},${al.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // Pointer halo — links + brightens nearby nodes.
      const pd = Math.hypot(a.x - this.px, a.y - this.py);
      if (pd < 170) {
        const al = (1 - pd / 170) * 0.7;
        ctx.strokeStyle = `rgba(${lr},${lg},${lb},${al.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(this.px, this.py);
        ctx.stroke();
      }
      const big = pd < 170;
      ctx.fillStyle = `rgba(${nr},${ng},${nb},${big ? 0.95 : 0.55})`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, big ? 2.2 : 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
