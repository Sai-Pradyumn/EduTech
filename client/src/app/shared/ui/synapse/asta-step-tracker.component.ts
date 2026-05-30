import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StepItem } from './synapse.types';

/**
 * Asta — Step Tracker. A reusable vertical timeline of steps (roadmap weeks,
 * milestones, project phases) whose status is DATA-DRIVEN and changed by an
 * explicit "Mark complete" toggle — never by scroll. The connecting spine fills
 * to the last completed step; the active step pulses and reveals its sub-tasks.
 */
@Component({
  selector: 'asta-step-tracker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="track" [style.--filled]="filledPct()">
      @for (s of steps(); track $index; let i = $index) {
        <li class="step {{ s.state }}">
          <span class="rail" aria-hidden="true"></span>
          <span class="marker">
            @if (s.state === 'completed') {
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            } @else if (s.state === 'locked') {
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            } @else { <em>{{ i + 1 }}</em> }
          </span>

          <div class="body min-w-0">
            <div class="row">
              <p class="title">{{ s.title }}</p>
              @if (s.actionable && s.state !== 'locked') {
                <button type="button" class="mark {{ s.state === 'completed' ? 'done' : '' }}" (click)="toggle.emit(i)">
                  @if (s.state === 'completed') {
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    Completed
                  } @else { Mark complete }
                </button>
              }
            </div>
            @if (s.detail) { <p class="detail">{{ s.detail }}</p> }
            @if (s.state === 'active' && s.tasks?.length) {
              <ul class="tasks">
                @for (t of s.tasks; track t) { <li>{{ t }}</li> }
              </ul>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: [
    `
      .track { position: relative; list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
      .step { position: relative; display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 14px; padding: 10px 12px 10px 0; border-radius: var(--r-sm); transition: background .2s var(--ease); }
      .step:hover { background: color-mix(in oklch, var(--paper-2) 55%, transparent); }

      /* Connecting spine — accent up to completed, faint after. */
      .rail { position: absolute; left: 14px; top: 26px; bottom: -6px; width: 2px; border-radius: 2px; background: color-mix(in oklch, var(--text-mute) 20%, transparent); }
      .step:last-child .rail { display: none; }
      .step.completed .rail { background: linear-gradient(180deg, var(--green), var(--green-deep)); }

      .marker {
        position: relative; z-index: 1;
        width: 30px; height: 30px; display: grid; place-items: center;
        border-radius: 999px;
        font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--text-soft);
        background: var(--paper);
        border: 1px solid color-mix(in oklch, var(--text-mute) 28%, transparent);
        transition: transform .24s var(--ease-spring), background .24s var(--ease), color .24s var(--ease);
      }
      .step.completed .marker { color: #06100a; background: linear-gradient(135deg, var(--green), var(--green-deep)); border-color: transparent; }
      .step.active .marker { color: #06100a; background: radial-gradient(circle at 34% 28%, #fff, transparent 30%), conic-gradient(from 140deg, var(--green), var(--asta-cyan), var(--green-deep), var(--green)); border-color: transparent; box-shadow: 0 0 0 5px color-mix(in oklch, var(--green) 12%, transparent); animation: stepPulse 2.4s ease-in-out infinite; }
      .step.locked .marker { opacity: 0.6; }
      @keyframes stepPulse { 0%,100%{ box-shadow:0 0 0 5px color-mix(in oklch, var(--green) 12%, transparent);} 50%{ box-shadow:0 0 0 9px color-mix(in oklch, var(--green) 3%, transparent);} }

      .body { padding-top: 4px; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .title { font-size: 14.5px; font-weight: 600; color: var(--text); line-height: 1.25; }
      .step.completed .title { color: var(--text-soft); }
      .detail { font-size: 13px; color: var(--text-mute); margin-top: 2px; }
      .tasks { margin: 8px 0 2px; padding: 0; list-style: none; display: grid; gap: 4px; }
      .tasks li { font-size: 13px; color: var(--text-soft); padding-left: 16px; position: relative; }
      .tasks li::before { content: ''; position: absolute; left: 2px; top: 8px; width: 5px; height: 5px; border-radius: 999px; background: var(--green-deep); }

      .mark {
        flex-shrink: 0;
        display: inline-flex; align-items: center; gap: 6px;
        border: 1px solid color-mix(in oklch, var(--text-mute) 26%, transparent);
        background: transparent; color: var(--text-soft);
        border-radius: 999px; padding: 6px 12px;
        font-family: var(--body); font-size: 12.5px; font-weight: 600; cursor: pointer;
        transition: border-color .18s var(--ease), color .18s var(--ease), background .18s var(--ease), transform .12s var(--ease-spring);
      }
      .mark:hover { border-color: color-mix(in oklch, var(--green) 40%, transparent); color: var(--text); background: var(--asta-accent-glow); }
      .mark:active { transform: scale(.96); }
      .mark.done { color: var(--green-deep); border-color: color-mix(in oklch, var(--green) 36%, transparent); background: color-mix(in oklch, var(--green) 12%, transparent); }
      .mark.done svg { animation: markPop .4s var(--ease-spring); }
      @keyframes markPop { 0%{ transform: scale(0); } 60%{ transform: scale(1.3);} 100%{ transform: scale(1);} }
    `,
  ],
})
export class AstaStepTrackerComponent {
  readonly steps = input<StepItem[]>([]);
  readonly toggle = output<number>();

  /** % of the spine that should read as completed (for any future gradient use). */
  filledPct() {
    const s = this.steps();
    if (!s.length) return '0%';
    const done = s.filter((x) => x.state === 'completed').length;
    return `${Math.round((done / s.length) * 100)}%`;
  }
}
