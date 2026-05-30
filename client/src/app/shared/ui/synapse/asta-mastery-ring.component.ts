import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SynapseTone, TONE_VAR } from './synapse.types';

/**
 * Asta Synapse — Mastery Ring. A conic progress ring + copy. Replaces the
 * repeated "icon + number + label" stat card for mastery / readiness / health /
 * performance. Tone follows the contextual palette by default.
 */
@Component({
  selector: 'asta-mastery-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mastery hover-lift" [style.--mv]="clamped()" [style.--ring]="ringColor()">
      <div class="ring"><span>{{ clamped() }}{{ unit() }}</span></div>
      <div class="copy min-w-0">
        <span class="label">{{ label() }}</span>
        @if (title()) { <h3 class="title">{{ title() }}</h3> }
        @if (note()) { <p class="note">{{ note() }}</p> }
      </div>
    </article>
  `,
  styles: [
    `
      .mastery {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr);
        gap: 16px;
        align-items: center;
        padding: 18px;
        border-radius: var(--r-lg);
        background:
          radial-gradient(circle at 10% 20%, color-mix(in oklch, var(--ring) 14%, transparent), transparent 30%),
          var(--paper);
        box-shadow: var(--shadow-sm), inset 0 1px 0 0 var(--card-hi);
      }
      .ring {
        position: relative;
        width: 76px; height: 76px;
        border-radius: 999px;
        display: grid; place-items: center;
        background: conic-gradient(var(--ring) calc(var(--mv) * 1%), color-mix(in oklch, var(--text-mute) 22%, transparent) 0);
        transition: background 0.8s var(--ease);
      }
      .ring::before {
        content: '';
        position: absolute; inset: 7px;
        border-radius: inherit;
        background: var(--paper);
        box-shadow: inset 0 2px 8px oklch(0.2 0.03 264 / 0.08);
      }
      .ring span { position: relative; z-index: 1; font-family: var(--display); font-weight: 700; font-size: 18px; color: var(--text); }
      .label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-mute); }
      .title { font-family: var(--display); font-size: 17px; font-weight: 600; margin-top: 1px; }
      .note { font-size: 13px; color: var(--text-soft); margin-top: 3px; }
    `,
  ],
})
export class AstaMasteryRingComponent {
  readonly value = input<number>(0);
  readonly label = input<string>('');
  readonly title = input<string>('');
  readonly note = input<string>('');
  readonly unit = input<string>('%');
  readonly tone = input<SynapseTone>('accent');

  readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.value()))));
  readonly ringColor = computed(() => TONE_VAR[this.tone()]);
}
