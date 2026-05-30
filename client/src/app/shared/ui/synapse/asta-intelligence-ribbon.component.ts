import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Asta Synapse — Intelligence Ribbon. Surfaces one strong AI insight (NOT a
 * bordered alert): a conic AI orb + insight copy + projected actions. Used after
 * a hero/title on dashboards, tutor, mentor, intelligence, admin.
 */
@Component({
  selector: 'asta-intelligence-ribbon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ribbon motion-reveal">
      <div class="orb" aria-hidden="true"></div>
      <div class="copy min-w-0">
        <span class="label">{{ label() }}</span>
        @if (title()) { <strong class="title">{{ title() }}</strong> }
        @if (description()) { <p class="desc">{{ description() }}</p> }
      </div>
      <div class="actions"><ng-content /></div>
    </section>
  `,
  styles: [
    `
      .ribbon {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
        padding: 18px 20px;
        border-radius: var(--r-lg);
        background:
          radial-gradient(circle at 3% 20%, var(--asta-accent-glow), transparent 30%),
          var(--paper);
        box-shadow: var(--shadow-sm), inset 0 1px 0 0 var(--card-hi);
      }
      .orb {
        width: 42px; height: 42px; border-radius: 999px;
        background:
          radial-gradient(circle at 35% 28%, #fff, transparent 22%),
          conic-gradient(from 180deg, var(--asta-blue), var(--asta-cyan), var(--asta-violet), var(--asta-blue));
        box-shadow: 0 0 24px var(--asta-glow-blue), 0 0 52px var(--asta-glow-cyan);
        animation: astaOrbitSpin 18s linear infinite;
      }
      .label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--asta-accent); }
      .title { display: block; font-family: var(--display); font-size: 17px; font-weight: 600; margin-top: 2px; color: var(--text); }
      .desc { font-size: 14px; color: var(--text-soft); margin-top: 3px; }
      .actions { display: flex; gap: 8px; align-items: center; }
      @media (max-width: 720px) {
        .ribbon { grid-template-columns: 44px 1fr; }
        .actions { grid-column: 1 / -1; }
      }
    `,
  ],
})
export class AstaIntelligenceRibbonComponent {
  readonly label = input<string>('Asta insight');
  readonly title = input<string>('');
  readonly description = input<string>('');
}
