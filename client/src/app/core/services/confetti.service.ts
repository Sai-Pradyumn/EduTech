import { Injectable } from '@angular/core';

/**
 * Celebration confetti (D2) — a one-shot canvas burst for milestone moments
 * (quiz passed, project completed, roadmap finished). Dependency-free, draws to a
 * transient full-viewport canvas it removes when settled. Honors
 * `prefers-reduced-motion` (no-op), so it never fights accessibility.
 */
@Injectable({ providedIn: 'root' })
export class ConfettiService {
  private readonly colors = ['#16a34a', '#34d399', '#f0653a', '#7c83ff', '#facc15'];

  /** Fire a burst from `origin` (viewport ratios, default top-centre). */
  burst(origin: { x?: number; y?: number; count?: number } = {}): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2000';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }
    ctx.scale(dpr, dpr);

    const W = window.innerWidth;
    const H = window.innerHeight;
    const ox = (origin.x ?? 0.5) * W;
    const oy = (origin.y ?? 0.3) * H;
    const n = origin.count ?? 120;

    const parts = Array.from({ length: n }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 9;
      return {
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.4,
        color: this.colors[(Math.random() * this.colors.length) | 0],
        life: 1,
      };
    });

    const gravity = 0.32;
    const drag = 0.985;
    let raf = 0;
    const start = performance.now();

    const frame = (t: number): void => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      const fade = Math.max(0, 1 - (t - start) / 2200);
      for (const p of parts) {
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y < H + 20 && fade > 0) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) {
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    };
    raf = requestAnimationFrame(frame);
  }
}
