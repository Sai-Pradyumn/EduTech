import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NextAction } from '../../core/models';

/**
 * Bottom strip: Asta's single best next move (from AgentService.nextAction) plus
 * fast follow-ups. Emitting `act` sends a prompt to the session; `open` routes
 * to an existing surface when the next action carries a route.
 */
@Component({
  selector: 'asta-os-today-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip">
      <div class="best">
        <span class="kick">Best move now</span>
        @if (next(); as n) {
          <button type="button" class="lead" (click)="trigger(n)">
            <span class="dot" aria-hidden="true"></span>
            <span class="txt">{{ n.label }}</span>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        } @else {
          <button type="button" class="lead" (click)="act.emit('What should I work on now?')">
            <span class="dot" aria-hidden="true"></span>
            <span class="txt">Ask Asta what to do next</span>
          </button>
        }
      </div>

      <div class="quick" role="group" aria-label="Quick actions">
        @for (q of quick; track q.prompt) {
          <button type="button" class="q" (click)="act.emit(q.prompt)">{{ q.label }}</button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .strip { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; justify-content: space-between; padding: 12px 16px; border-radius: 16px; background: var(--asta-panel); border: 1px solid var(--asta-border); backdrop-filter: blur(12px); }
      .best { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .kick { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-subtle); }
      .lead { display: inline-flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 600; color: var(--asta-text); }
      .lead:hover { color: var(--asta-green); }
      .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--asta-green); box-shadow: 0 0 10px var(--asta-green); flex-shrink: 0; }
      .quick { display: flex; flex-wrap: wrap; gap: 8px; }
      .q { font-size: 12.5px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--asta-border); background: transparent; color: var(--asta-muted); transition: color .16s ease, border-color .16s ease, transform .14s ease; }
      .q:hover { color: var(--asta-text); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); transform: translateY(-1px); }

      /* The best-move dot pulses — Asta has something for you. */
      .dot { animation: astaPulse 2.4s ease-in-out infinite; }
      .lead svg { transition: transform .2s var(--ease-spring); }
      .lead:hover svg { transform: translateX(3px); }
      .q { animation: astaRevealUp .4s var(--ease) both; }
      .q:nth-child(2) { animation-delay: .06s; }
      .q:nth-child(3) { animation-delay: .12s; }
      .q:nth-child(4) { animation-delay: .18s; }
      @media (prefers-reduced-motion: reduce) { .dot, .q { animation: none; } .lead:hover svg { transform: none; } }
    `,
  ],
})
export class AstaOsTodayStripComponent {
  readonly next = input<NextAction | null>(null);
  readonly act = output<string>();

  protected readonly quick: { label: string; prompt: string }[] = [
    { label: 'Continue plan', prompt: 'Continue my plan for today' },
    { label: 'Fix weak area', prompt: 'Help me fix my weakest topic' },
    { label: 'Practice now', prompt: 'Give me a coding practice problem' },
    { label: 'Explain visually', prompt: 'Explain my current topic visually' },
  ];

  /** Always resolve to an in-session prompt — Asta acts, no jump to a legacy screen. */
  protected trigger(n: NextAction): void {
    this.act.emit(n.prompt ?? n.label);
  }
}
