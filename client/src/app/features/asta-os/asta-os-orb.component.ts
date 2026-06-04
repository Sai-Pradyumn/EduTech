import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AstaOrbSize, AstaOrbState } from './asta-os.types';

/**
 * The living centre of Asta OS. A pure-CSS state machine — no canvas, no deps —
 * so it stays cheap and respects `prefers-reduced-motion` (animations collapse
 * to a static glow). Drive `state` from the session; `size` picks the scale.
 */
@Component({
  selector: 'asta-os-orb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="orb" [class]="state()" [style.--orb]="px()" role="img" [attr.aria-label]="aria()">
      <span class="core"></span>
      <span class="ring r1"></span>
      <span class="ring r2"></span>
      <span class="ring r3"></span>
      <span class="arc"></span>
      <span class="dot d1"></span>
      <span class="dot d2"></span>
      <span class="dot d3"></span>
    </div>
    @if (label(); as l) { <p class="orb-label">{{ l }}</p> }
  `,
  styles: [
    `
      :host { display: inline-flex; flex-direction: column; align-items: center; gap: 10px; }
      .orb {
        position: relative;
        width: var(--orb);
        height: var(--orb);
        display: grid;
        place-items: center;
        isolation: isolate;
      }
      .core {
        position: absolute;
        inset: 14%;
        border-radius: 999px;
        background:
          radial-gradient(circle at 36% 30%, #fff 0%, transparent 30%),
          conic-gradient(from 140deg, var(--asta-green), var(--asta-cyan), var(--asta-violet), var(--asta-green));
        box-shadow: 0 0 calc(var(--orb) * 0.22) color-mix(in srgb, var(--asta-green) 55%, transparent),
          0 0 calc(var(--orb) * 0.5) color-mix(in srgb, var(--asta-cyan) 28%, transparent);
        animation: breathe 5.5s ease-in-out infinite;
      }
      .ring, .arc, .dot { position: absolute; border-radius: 999px; opacity: 0; pointer-events: none; }
      .ring { inset: 0; border: 1.5px solid color-mix(in srgb, var(--asta-cyan) 70%, transparent); }
      .arc {
        inset: 6%;
        border: 2px solid transparent;
        border-top-color: var(--asta-green);
        border-right-color: color-mix(in srgb, var(--asta-violet) 80%, transparent);
      }
      .dot {
        width: 9%;
        height: 9%;
        background: var(--asta-green);
        box-shadow: 0 0 8px var(--asta-green);
        top: 46%; left: 46%;
      }

      /* idle — gentle breathing only (default). */
      .idle .core { animation: breathe 5.5s ease-in-out infinite; }

      /* listening — expanding audio rings. */
      .listening .ring { opacity: 1; animation: pulseRing 2.2s ease-out infinite; }
      .listening .r2 { animation-delay: .7s; }
      .listening .r3 { animation-delay: 1.4s; }

      /* thinking — rotating neural arc. */
      .thinking .arc { opacity: 1; animation: spin 1.6s linear infinite; }

      /* agents-running — orbiting agent dots. */
      .agents-running .dot { opacity: 1; }
      .agents-running .d1 { animation: orbit 2.4s linear infinite; }
      .agents-running .d2 { animation: orbit 2.4s linear infinite; animation-delay: -.8s; }
      .agents-running .d3 { animation: orbit 2.4s linear infinite; animation-delay: -1.6s; }

      /* speaking — waveform pulse. */
      .speaking .core { animation: speak .9s ease-in-out infinite; }

      /* success — soft green bloom. */
      .success .core { box-shadow: 0 0 calc(var(--orb) * 0.4) var(--asta-green), 0 0 calc(var(--orb) * 0.8) color-mix(in srgb, var(--asta-green) 50%, transparent); }

      /* warning / error — coloured edge glow. */
      .warning .ring.r1 { opacity: 1; border-color: var(--asta-warning); box-shadow: 0 0 16px var(--asta-warning); }
      .error .ring.r1 { opacity: 1; border-color: var(--asta-danger); animation: errPulse 1.1s ease-in-out infinite; }

      .orb-label { font-family: var(--mono); font-size: 11px; letter-spacing: .04em; color: var(--asta-muted); text-transform: uppercase; }

      @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      @keyframes pulseRing { 0% { transform: scale(.55); opacity: .7; } 100% { transform: scale(1.15); opacity: 0; } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes orbit { from { transform: rotate(0) translateX(calc(var(--orb) * 0.42)) rotate(0); } to { transform: rotate(360deg) translateX(calc(var(--orb) * 0.42)) rotate(-360deg); } }
      @keyframes speak { 0%, 100% { transform: scale(1); } 25% { transform: scale(1.08); } 60% { transform: scale(.97); } }
      @keyframes errPulse { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }

      @media (prefers-reduced-motion: reduce) {
        .core, .ring, .arc, .dot { animation: none !important; }
        .listening .ring, .agents-running .dot, .thinking .arc { opacity: .85; }
      }
    `,
  ],
})
export class AstaOsOrbComponent {
  readonly state = input<AstaOrbState>('idle');
  readonly size = input<AstaOrbSize>('md');
  readonly label = input<string | null>(null);

  private readonly sizes: Record<AstaOrbSize, string> = { sm: '36px', md: '56px', lg: '96px', hero: '160px' };
  readonly px = computed(() => this.sizes[this.size()]);

  private readonly labels: Record<AstaOrbState, string> = {
    idle: 'Asta is ready',
    listening: 'Asta is listening',
    thinking: 'Asta is thinking',
    speaking: 'Asta is speaking',
    'agents-running': 'Asta is working',
    success: 'Asta finished',
    warning: 'Asta needs your attention',
    error: 'Something went wrong',
  };
  readonly aria = computed(() => this.labels[this.state()]);
}
