import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SignalEvent, TONE_VAR } from './synapse.types';

/**
 * Asta Synapse — Signal Timeline. A connected stream of events (NOT a plain list)
 * for activity, notifications, agent events, admin logs. Each node glows in its
 * tone; the active event is emphasised.
 */
@Component({
  selector: 'asta-signal-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline motion-stagger">
      @for (e of events(); track $index) {
        <article class="event" [class.active]="e.active" [style.--sig]="color(e)">
          <span class="node"></span>
          <div class="content min-w-0">
            <span class="time">{{ e.time }}</span>
            <h3 class="title">{{ e.title }}</h3>
            @if (e.detail) { <p class="detail">{{ e.detail }}</p> }
          </div>
        </article>
      }
    </div>
  `,
  styles: [
    `
      .timeline { position: relative; display: grid; gap: 12px; }
      .timeline::before {
        content: '';
        position: absolute;
        left: 13px; top: 18px; bottom: 18px;
        width: 1.5px;
        background: linear-gradient(180deg, transparent, color-mix(in oklch, var(--text-mute) 28%, transparent), transparent);
      }
      .event {
        position: relative;
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        gap: 14px;
        padding: 12px 14px;
        border-radius: var(--r-md);
        background: color-mix(in oklch, var(--paper) 55%, transparent);
        transition: transform 0.22s var(--ease), background 0.22s var(--ease);
      }
      .event:hover { transform: translateX(4px); background: var(--paper); }
      .event.active { background: var(--paper); box-shadow: var(--shadow-sm); }
      .node {
        width: 12px; height: 12px; margin-top: 6px;
        border-radius: 999px;
        background: var(--sig);
        box-shadow: 0 0 0 6px color-mix(in oklch, var(--sig) 14%, transparent);
        align-self: start;
      }
      .event.active .node { animation: astaPulse 2.2s ease-in-out infinite; }
      .time { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: var(--text-mute); }
      .title { font-size: 14.5px; font-weight: 600; line-height: 1.35; margin-top: 1px; }
      .detail { font-size: 13px; color: var(--text-soft); margin-top: 2px; }
    `,
  ],
})
export class AstaSignalTimelineComponent {
  readonly events = input<SignalEvent[]>([]);
  color(e: SignalEvent): string {
    return TONE_VAR[e.tone ?? 'accent'];
  }
}
