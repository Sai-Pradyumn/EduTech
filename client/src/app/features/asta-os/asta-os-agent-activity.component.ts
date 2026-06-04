import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AstaActivityRow } from './asta-os.types';

/**
 * Friendly "Asta is working" stream — never raw logs. Rows are pre-translated
 * (see friendlyActivity) into calm copy; completed rows show ✓, the active row
 * pulses. The shell decides when to show/hide this; here we just render.
 */
@Component({
  selector: 'asta-os-agent-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <div class="panel" aria-live="polite">
        <p class="head">Asta is working</p>
        <ul class="list">
          @for (r of rows(); track r.id) {
            <li class="row" [class.active]="r.status === 'active'">
              <span class="mark" aria-hidden="true">
                @if (r.status === 'done') {
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                } @else {
                  <span class="ping"></span>
                }
              </span>
              <span class="label">{{ r.label }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [
    `
      .panel { padding: 14px 16px; border-radius: 16px; background: var(--asta-panel); border: 1px solid var(--asta-border); backdrop-filter: blur(12px); }
      .head { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-muted); margin-bottom: 12px; }
      /* Vertical execution timeline: a connector line behind the node dots. */
      .list { display: flex; flex-direction: column; gap: 0; position: relative; }
      .list::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 14px; width: 1.5px; background: linear-gradient(var(--asta-green-deep), transparent); opacity: .5; }
      .row { display: flex; align-items: flex-start; gap: 12px; font-size: 13.5px; color: var(--asta-muted); transition: color .2s ease; padding: 5px 0; position: relative; }
      .row.active { color: var(--asta-text); }
      .mark { display: grid; place-items: center; width: 18px; height: 18px; flex-shrink: 0; color: var(--asta-green); background: var(--asta-bg-soft); border-radius: 999px; z-index: 1; }
      .label { padding-top: 1px; }
      .ping { width: 8px; height: 8px; border-radius: 999px; background: var(--asta-green); box-shadow: 0 0 8px var(--asta-green); animation: ping 1.2s ease-in-out infinite; }
      @keyframes ping { 0%, 100% { opacity: .4; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.2); } }
      @media (prefers-reduced-motion: reduce) { .ping { animation: none; } }
    `,
  ],
})
export class AstaOsAgentActivityComponent {
  readonly rows = input.required<readonly AstaActivityRow[]>();
}
