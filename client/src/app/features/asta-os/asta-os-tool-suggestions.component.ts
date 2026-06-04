import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AstaTool } from './asta-os-tools';

/**
 * "Open this with" — contextual tools Asta surfaces for a turn (Flow, Quiz,
 * Visual, …). Screens become tools, not destinations: the learner taps to open
 * the right surface instead of hunting through navigation. Emits the route.
 */
@Component({
  selector: 'asta-os-tool-suggestions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tools().length) {
      <div class="tools">
        <p class="kick">Open this with</p>
        <div class="row">
          @for (t of tools(); track t.id) {
            <button type="button" class="tool" (click)="open.emit(t)" [title]="t.blurb">
              <span class="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="t.icon" /></svg>
              </span>
              <span class="meta">
                <span class="label">{{ t.label }}</span>
                <span class="blurb">{{ t.blurb }}</span>
              </span>
              <svg class="arr" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tools { margin-top: 14px; }
      .kick { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-subtle); margin-bottom: 8px; }
      .row { display: flex; flex-wrap: wrap; gap: 8px; }
      .tool { display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--asta-border); background: var(--asta-panel); color: var(--asta-text); transition: transform .14s ease, border-color .14s ease, background .14s ease; text-align: left; animation: tlIn .34s cubic-bezier(.2,.7,.2,1) both; }
      .tool:nth-child(2) { animation-delay: .06s; }
      .tool:nth-child(3) { animation-delay: .12s; }
      .tool:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); background: var(--asta-panel-strong); }
      @keyframes tlIn { from { opacity: 0; transform: translateY(6px); } }
      @media (prefers-reduced-motion: reduce) { .tool { animation: none; } }
      .ic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--asta-green); background: color-mix(in srgb, var(--asta-green) 12%, transparent); flex-shrink: 0; }
      .meta { display: flex; flex-direction: column; line-height: 1.25; }
      .label { font-size: 13px; font-weight: 600; }
      .blurb { font-size: 11.5px; color: var(--asta-muted); }
      .arr { color: var(--asta-muted); flex-shrink: 0; }
    `,
  ],
})
export class AstaOsToolSuggestionsComponent {
  readonly tools = input.required<readonly AstaTool[]>();
  readonly open = output<AstaTool>();
}
