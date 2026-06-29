import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AstaTrustBadge } from './asta-os.types';

/**
 * Small Cognitive-Guardian trust badges shown on a completed Asta turn — the
 * user-facing face of validation/grounding. Never raw logs; each badge is
 * derived from a real signal (see deriveTrustBadges).
 */
@Component({
  selector: 'asta-os-trust-badges',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (badges().length) {
      <div class="badges" role="list" aria-label="How Asta checked this">
        @for (b of badges(); track b.id) {
          <span class="badge" [attr.data-tone]="b.tone" role="listitem">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 11l3 3L20 6" /><path d="M21 12a9 9 0 1 1-6.2-8.5" />
            </svg>
            {{ b.label }}
          </span>
        }
      </div>
    }
  `,
  styles: [
    `
      .badges { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
      .badge {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11px; font-weight: 600; letter-spacing: .01em;
        padding: 4px 10px; border-radius: 999px;
        border: 1px solid var(--asta-border);
        background: var(--asta-panel);
        color: var(--asta-muted);
      }
      .badge svg { opacity: .85; }
      .badge[data-tone='neutral'] { color: var(--asta-muted); border-color: var(--asta-border); }
      .badge[data-tone='grounded'] { color: var(--asta-cyan); border-color: color-mix(in srgb, var(--asta-cyan) 40%, transparent); }
      .badge[data-tone='practice'] { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .badge[data-tone='weak'] { color: var(--asta-coral); border-color: color-mix(in srgb, var(--asta-coral) 40%, transparent); }
      .badge[data-tone='roadmap'] { color: var(--asta-violet); border-color: color-mix(in srgb, var(--asta-violet) 40%, transparent); }
      .badge[data-tone='guiding'] { color: var(--asta-gold); border-color: color-mix(in srgb, var(--asta-gold) 40%, transparent); }

      /* Verification stamps land one by one as the turn completes. */
      .badge { animation: astaSoftPop .35s var(--ease-spring) both; }
      .badge:nth-child(2) { animation-delay: .08s; }
      .badge:nth-child(3) { animation-delay: .16s; }
      .badge:nth-child(4) { animation-delay: .24s; }
      .badge:nth-child(5) { animation-delay: .32s; }
      @media (prefers-reduced-motion: reduce) { .badge { animation: none; } }
    `,
  ],
})
export class AstaOsTrustBadgesComponent {
  readonly badges = input.required<readonly AstaTrustBadge[]>();
}
