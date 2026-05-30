import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { ParallaxDirective } from '../directives/parallax.directive';

/**
 * Aurora background — a few large, soft, slowly-drifting accent blobs that give
 * surfaces depth and motion. Scroll-reactive (each blob parallaxes at a
 * different depth) and theme-aware (uses accent tokens at low alpha, so it reads
 * on both light and dark). Mount inside a positioned container; sits behind
 * content. Honors reduced-motion (drift animation disabled via CSS).
 *
 * Usage:
 *   <div class="relative">
 *     <asta-aurora />
 *     ...content...
 *   </div>
 */
@Component({
  selector: 'asta-aurora',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ParallaxDirective],
  template: `
    <div class="blob b1" [astaParallax]="0.06" [astaParallaxScroll]="scrollSelector"></div>
    <div class="blob b2" [astaParallax]="0.11" [astaParallaxScroll]="scrollSelector"></div>
    <div class="blob b3" [astaParallax]="0.04" [astaParallaxScroll]="scrollSelector"></div>
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        /* Theme drives how strongly the blooms read: a faint wash on light,
           a brighter glow on dark. Multiplied by the per-instance intensity. */
        --aurora-theme-strength: 0.7;
      }
      :host-context([data-theme='dark']) {
        --aurora-theme-strength: 1.15;
      }
      .blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(70px);
        opacity: calc(var(--aurora-opacity, 0.6) * var(--aurora-theme-strength));
        will-change: transform;
        transition: background 0.6s var(--ease);
      }
      /* Blob colors derive from theme/accent tokens via color-mix so they shift
         with light/dark and any per-route accent tint (--bg-accent-*). */
      .b1 {
        width: 46vw;
        height: 46vw;
        top: -12vw;
        right: -8vw;
        background: radial-gradient(circle, color-mix(in oklch, var(--bg-accent-1, var(--accent)) 55%, transparent), transparent 65%);
        animation: drift1 26s var(--ease) infinite alternate;
      }
      .b2 {
        width: 38vw;
        height: 38vw;
        bottom: -14vw;
        left: -6vw;
        background: radial-gradient(circle, color-mix(in oklch, var(--bg-accent-2, var(--peri)) 50%, transparent), transparent 65%);
        animation: drift2 32s var(--ease) infinite alternate;
      }
      .b3 {
        width: 30vw;
        height: 30vw;
        top: 30%;
        left: 40%;
        background: radial-gradient(circle, color-mix(in oklch, var(--bg-accent-3, var(--coral)) 42%, transparent), transparent 65%);
        animation: drift3 38s var(--ease) infinite alternate;
      }
      @keyframes drift1 { to { transform: translate(-8%, 10%) scale(1.12); } }
      @keyframes drift2 { to { transform: translate(10%, -8%) scale(1.08); } }
      @keyframes drift3 { to { transform: translate(-12%, -10%) scale(1.15); } }
      @media (prefers-reduced-motion: reduce) {
        .blob { animation: none; }
      }
    `,
  ],
})
export class AuroraComponent {
  /** Overall intensity 0–1 (drives blob opacity). */
  @Input() intensity = 0.6;
  /** Optional CSS selector for the scroll container that drives parallax drift. */
  @Input() scrollSelector?: string;

  @HostBinding('style.--aurora-opacity') get auroraOpacity(): number {
    return this.intensity;
  }
}
