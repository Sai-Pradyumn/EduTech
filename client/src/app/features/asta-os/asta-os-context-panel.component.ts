import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LearningIntelligence, NextAction } from '../../core/models';

interface ContextRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly accent?: boolean;
}

/**
 * Right rail: the learner's current state at a glance. Driven entirely by real
 * data (the cached LearningIntelligence snapshot + the proactive NextAction).
 * Sections with no data are simply omitted — nothing is fabricated.
 */
@Component({
  selector: 'asta-os-context-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="panel" aria-label="Your learning context">
      <p class="head">Your context</p>
      @if (rows().length) {
        <dl class="rows">
          @for (r of rows(); track r.key) {
            <div class="row">
              <dt>{{ r.label }}</dt>
              <dd [class.accent]="r.accent">{{ r.value }}</dd>
            </div>
          }
        </dl>
      } @else {
        <p class="empty">Ask Asta anything and your goal, weak areas and plan will appear here.</p>
      }
    </aside>
  `,
  styles: [
    `
      .panel { padding: 18px; border-radius: 18px; background: var(--asta-panel); border: 1px solid var(--asta-border); backdrop-filter: blur(14px); }
      .head { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-muted); margin-bottom: 14px; }
      .rows { display: flex; flex-direction: column; gap: 14px; }
      .row { display: flex; flex-direction: column; gap: 3px; }
      dt { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--asta-subtle); }
      dd { font-size: 14px; color: var(--asta-text); line-height: 1.45; }
      dd.accent { color: var(--asta-green); font-weight: 600; }
      .empty { font-size: 13px; color: var(--asta-muted); line-height: 1.55; }

      /* Context facts settle in one by one; the weak area carries a soft warning glow. */
      .row { animation: astaRevealUp .4s var(--ease) both; }
      .row:nth-child(2) { animation-delay: .06s; }
      .row:nth-child(3) { animation-delay: .12s; }
      .row:nth-child(4) { animation-delay: .18s; }
      .row:nth-child(5) { animation-delay: .24s; }
      dd.accent { text-shadow: 0 0 14px color-mix(in srgb, var(--asta-green) 45%, transparent); }
      @media (prefers-reduced-motion: reduce) { .row { animation: none; } }
    `,
  ],
})
export class AstaOsContextPanelComponent {
  readonly intel = input<LearningIntelligence | null>(null);
  readonly next = input<NextAction | null>(null);

  readonly rows = computed<ContextRow[]>(() => {
    const out: ContextRow[] = [];
    const intel = this.intel();
    const next = this.next();

    if (next?.label) out.push({ key: 'goal', label: 'Current goal', value: next.label });
    else if (intel?.headline) out.push({ key: 'goal', label: 'Current goal', value: intel.headline });

    const weak = intel?.weaknesses?.[0];
    if (weak) out.push({ key: 'weak', label: 'Weak area', value: weak.topic, accent: true });

    if (typeof intel?.momentum.streak === 'number' && intel.momentum.streak > 0) {
      out.push({ key: 'streak', label: 'Streak', value: `${intel.momentum.streak}-day learning streak` });
    }
    if (typeof intel?.readinessScore === 'number' && intel.hasData) {
      out.push({ key: 'readiness', label: 'Readiness', value: `${Math.round(intel.readinessScore)}%` });
    }

    const rec = next?.reason ?? intel?.recommendations?.[0];
    if (rec) out.push({ key: 'rec', label: 'Asta recommends', value: rec });

    return out;
  });
}
