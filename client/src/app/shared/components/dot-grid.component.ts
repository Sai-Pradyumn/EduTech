import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  inject,
} from '@angular/core';

/**
 * Animated dotted background — an infinitely drifting dot pattern with optional
 * pointer parallax. Reusable behind any positioned (relative) container.
 *
 * Usage:
 *   <div class="relative">
 *     <asta-dot-grid [opacity]=".5" [parallax]="true" />
 *     ...content...
 *   </div>
 *
 * Honors prefers-reduced-motion (freezes the drift, keeps the static pattern).
 */
@Component({
  selector: 'asta-dot-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="grid-layer" [style.opacity]="opacity"></div>`,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        /* Token-driven so the texture reads on both themes (muted on light,
           a faint lift on dark) rather than a fixed ink tint. */
        --dot-color: color-mix(in oklch, var(--text-mute) 22%, transparent);
      }
      .grid-layer {
        position: absolute;
        inset: -40px;
        background-image: radial-gradient(var(--dot-color) var(--dot-r, 0.9px), transparent var(--dot-r, 0.9px));
        background-size: var(--dot-gap, 22px) var(--dot-gap, 22px);
        will-change: transform, background-position;
        animation: dotDrift var(--drift-dur, 40s) linear infinite;
        transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      @keyframes dotDrift {
        to {
          background-position: var(--dot-gap, 22px) var(--dot-gap, 22px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .grid-layer {
          animation: none;
          transition: none;
        }
      }
    `,
  ],
})
export class DotGridComponent {
  /** Layer opacity 0–1. */
  @Input() opacity = 0.5;
  /** Gap between dots in px. */
  @Input() set gap(v: number) {
    this.host.style.setProperty('--dot-gap', `${v}px`);
  }
  /** Dot radius in px. */
  @Input() set radius(v: number) {
    this.host.style.setProperty('--dot-r', `${v}px`);
  }
  /** Drift loop duration in seconds (lower = faster). */
  @Input() set speed(v: number) {
    this.host.style.setProperty('--drift-dur', `${v}s`);
  }
  /** CSS color for the dots (defaults to a token-driven muted ink). */
  @Input() set color(v: string) {
    this.host.style.setProperty('--dot-color', v);
  }
  /** Enable subtle pointer parallax of the layer. */
  @Input() parallax = false;
  /** Parallax travel in px. */
  @Input() parallaxStrength = 18;

  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);
  private get host(): HTMLElement {
    return this.hostRef.nativeElement;
  }
  private get layer(): HTMLElement | null {
    return this.host.querySelector<HTMLElement>('.grid-layer');
  }

  @HostListener('window:pointermove', ['$event'])
  onPointer(e: PointerEvent): void {
    if (!this.parallax) return;
    if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const layer = this.layer;
    if (!layer) return;
    const x = (e.clientX / window.innerWidth - 0.5) * this.parallaxStrength;
    const y = (e.clientY / window.innerHeight - 0.5) * this.parallaxStrength;
    layer.style.transform = `translate(${x}px, ${y}px)`;
  }
}
