import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Friendly empty state (DESIGN_SPEC §8) — a small living moment instead of a
 * static glyph: breathing halo, draw-animated path with endpoint pops, staggered
 * copy. Same API ([title], [description], projected action); CSS-only motion,
 * neutralized globally under prefers-reduced-motion.
 */
@Component({
  selector: 'asta-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center text-center py-12 px-6">
      <span class="es-glyph grid place-items-center mb-5 rounded-2xl" aria-hidden="true">
        <span class="es-halo" aria-hidden="true"></span>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
          stroke="var(--green-deep)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path class="es-path" d="M4 20 C4 11, 11 4, 20 4" />
          <circle class="es-dot es-dot-a" cx="4" cy="20" r="1.6" fill="var(--green-deep)" stroke="none" />
          <circle class="es-dot es-dot-b" cx="20" cy="4" r="1.6" fill="var(--green-deep)" stroke="none" />
        </svg>
      </span>
      <h3 class="es-rise text-xl mb-1.5">{{ title }}</h3>
      @if (description) {
        <p class="es-rise es-rise-2 text-txt-soft max-w-sm mb-5">{{ description }}</p>
      }
      <div class="es-rise es-rise-3"><ng-content /></div>
    </div>
  `,
  styles: [
    `
      .es-glyph {
        position: relative;
        width: 56px;
        height: 56px;
        background: color-mix(in oklch, var(--green) 14%, transparent);
        animation: astaSoftPop 0.4s var(--ease-spring) both;
      }
      .es-halo {
        position: absolute;
        inset: -6px;
        border-radius: 20px;
        pointer-events: none;
        background: radial-gradient(circle, color-mix(in oklch, var(--green) 24%, transparent), transparent 70%);
        animation: esBreathe 3.2s ease-in-out infinite;
      }
      @keyframes esBreathe {
        0%, 100% { opacity: 0.45; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.12); }
      }
      .es-path {
        stroke-dasharray: 26;
        stroke-dashoffset: 26;
        animation: esDraw 0.9s var(--ease) 0.25s forwards;
      }
      @keyframes esDraw { to { stroke-dashoffset: 0; } }
      .es-dot { opacity: 0; animation: esPop 0.3s var(--ease-spring) forwards; }
      .es-dot-a { animation-delay: 0.25s; }
      .es-dot-b { animation-delay: 1.05s; }
      @keyframes esPop { to { opacity: 1; } }
      .es-rise { animation: astaRevealUp 0.45s var(--ease) 0.15s both; }
      .es-rise-2 { animation-delay: 0.24s; }
      .es-rise-3 { animation-delay: 0.33s; }

      @media (prefers-reduced-motion: reduce) {
        .es-glyph, .es-halo, .es-rise { animation: none; }
        .es-path { stroke-dashoffset: 0; animation: none; }
        .es-dot { opacity: 1; animation: none; }
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() description = '';
}
