import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AgentOrbit, TONE_VAR } from './synapse.types';

/**
 * Asta Synapse — Agent Orbit card. A single AI agent with a live state glyph
 * (idle/listening/retrieving/reasoning/validating/streaming/complete/failed).
 * Compose several into an agent rail / swarm on AI screens.
 */
@Component({
  selector: 'asta-agent-orbit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="orbit hover-lift" [class.busy]="busy()" [style.--tone]="tone()">
      <div class="glyph" aria-hidden="true"><span class="dot"></span></div>
      <div class="copy min-w-0">
        <span class="state">{{ stateLabel() }}</span>
        <h3 class="name">{{ agent().name }}</h3>
        <p class="detail">{{ agent().detail }}</p>
      </div>
    </article>
  `,
  styles: [
    `
      .orbit {
        display: grid;
        grid-template-columns: 46px minmax(0, 1fr);
        gap: 14px;
        align-items: center;
        padding: 16px;
        border-radius: var(--r-lg);
        background:
          radial-gradient(circle at 15% 12%, color-mix(in oklch, var(--tone) 12%, transparent), transparent 30%),
          var(--paper);
        box-shadow: var(--shadow-sm), inset 0 1px 0 0 var(--card-hi);
      }
      .orbit.busy { box-shadow: var(--shadow-md), 0 0 0 6px color-mix(in oklch, var(--tone) 9%, transparent); }
      .glyph {
        position: relative; width: 46px; height: 46px;
        display: grid; place-items: center;
      }
      .glyph::before {
        content: ''; position: absolute; inset: 0;
        border-radius: 999px;
        border: 1px dashed color-mix(in oklch, var(--tone) 45%, transparent);
      }
      .orbit.busy .glyph::before { animation: astaOrbitSpin 6s linear infinite; }
      .dot {
        width: 16px; height: 16px; border-radius: 999px;
        background: radial-gradient(circle at 32% 28%, #fff, transparent 30%), var(--tone);
        box-shadow: 0 0 14px color-mix(in oklch, var(--tone) 60%, transparent);
      }
      .state { font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tone); }
      .name { font-family: var(--display); font-size: 16px; font-weight: 600; margin-top: 1px; }
      .detail { font-size: 13px; color: var(--text-soft); margin-top: 2px; }
    `,
  ],
})
export class AstaAgentOrbitComponent {
  readonly agent = input.required<AgentOrbit>();
  readonly tone = computed(() => TONE_VAR[this.agent().tone ?? 'accent']);
  readonly busy = computed(() => ['listening', 'retrieving', 'reasoning', 'validating', 'streaming'].includes(this.agent().state));
  readonly stateLabel = computed(() => {
    const s = this.agent().state;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
