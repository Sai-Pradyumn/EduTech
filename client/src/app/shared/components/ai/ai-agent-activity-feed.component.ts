import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { WorkflowStepView } from '../../../core/models';

/** Live "agent is working" transparency feed: Loading profile → Searching KB → … */
@Component({
  selector: 'ai-agent-activity-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" style="padding:14px 16px">
      <p class="kicker mb-3">{{ running ? 'Agent working' : 'Agent workflow' }}</p>
      <ol class="space-y-2.5">
        @for (s of steps; track $index) {
          <li class="flex items-center gap-2.5 text-sm">
            <span class="grid place-items-center rounded-full shrink-0" style="width:18px;height:18px"
              [style.background]="dotBg(s)" [style.border]="'2px solid ' + dotBorder(s)">
              @if (s.kind === 'done') {
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>
              }
            </span>
            <span [class.text-txt-mute]="s.kind === 'tool_result'">{{ s.label }}</span>
          </li>
        } @empty {
          <li class="text-sm text-txt-mute">Ask something to see the agent's reasoning steps.</li>
        }
        @if (running) {
          <li class="flex items-center gap-2.5 text-sm text-txt-mute">
            <span class="inline-block w-4 h-4 rounded-full border-2 border-[var(--paper-3)] border-t-[var(--green-deep)] animate-spin"></span>
            thinking…
          </li>
        }
      </ol>
    </div>
  `,
})
export class AiAgentActivityFeedComponent {
  @Input() steps: WorkflowStepView[] = [];
  @Input() running = false;

  dotBg(s: WorkflowStepView): string {
    if (s.kind === 'done') return 'var(--green)';
    if (s.kind === 'tool_call') return 'oklch(0.78 0.16 38 / .2)';
    return 'var(--paper)';
  }
  dotBorder(s: WorkflowStepView): string {
    if (s.kind === 'done') return 'var(--green)';
    if (s.kind === 'tool_call') return 'var(--coral)';
    return 'var(--peri)';
  }
}
