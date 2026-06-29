import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RoadmapWeek } from '../../../core/models';

export interface TaskToggle {
  taskId: string;
  completed: boolean;
}

/** Expandable week row on the roadmap detail page (timeline node). */
@Component({
  selector: 'asta-week-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative pl-8">
      <!-- timeline node -->
      <span class="wk-node absolute left-0 top-1.5 grid place-items-center rounded-full"
        [class.wk-node-done]="completed" [class.wk-node-current]="isCurrent && !completed"
        style="width:18px;height:18px"
        [style.background]="completed ? 'var(--green)' : 'var(--paper)'"
        [style.border]="'2px solid ' + (completed ? 'var(--green)' : isCurrent ? 'var(--peri)' : 'var(--paper-3)')">
        @if (completed) {
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path class="wk-check" d="M5 13l4 4L19 7"/></svg>
        }
      </span>

      <div class="card mb-3 wk" [class.wk-current]="isCurrent && !completed" [class.wk-done]="completed"
        [style.borderColor]="isCurrent && !completed ? 'var(--peri)' : null" style="padding:16px 18px">
        <button type="button" class="w-full flex items-center justify-between gap-3 text-left" (click)="open.set(!open())">
          <div class="min-w-0">
            <p class="font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5"
              [style.color]="isCurrent && !completed ? 'var(--peri-deep)' : 'var(--text-mute)'">
              Week {{ week.weekNumber }}
              @if (isCurrent && !completed) { <span class="wk-tag">In focus</span> }
              @else if (completed) { <span class="wk-tag wk-tag-done">Done</span> }
            </p>
            <h4 class="text-[16px] font-semibold truncate">{{ week.focus }}</h4>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <button type="button"
              class="text-xs font-semibold px-3 py-1.5 rounded-full"
              [style.background]="completed ? 'oklch(0.80 0.16 150 / .16)' : 'var(--paper-2)'"
              [style.color]="completed ? 'var(--green-deep)' : 'var(--text-soft)'"
              (click)="toggleWeek($event)">
              {{ completed ? 'Completed' : 'Mark done' }}
            </button>
            <span class="text-txt-mute transition-transform" [style.transform]="open() ? 'rotate(180deg)' : null">▾</span>
          </div>
        </button>

        @if (open()) {
          <div class="wk-expand mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-[12px] font-mono uppercase tracking-wider text-txt-mute mb-1.5">Topics</p>
              <div class="flex flex-wrap gap-1.5">
                @for (t of week.topics; track t) { <span class="pill">{{ t }}</span> }
              </div>
            </div>
            <div>
              <p class="text-[12px] font-mono uppercase tracking-wider text-txt-mute mb-1.5">Practice</p>
              <ul class="text-sm text-txt-soft list-disc pl-4 space-y-1">
                @for (p of week.practiceItems; track p) { <li>{{ p }}</li> }
              </ul>
            </div>
            <div class="sm:col-span-2">
              <p class="text-[12px] font-mono uppercase tracking-wider text-txt-mute mb-1.5">Tasks</p>
              <ul class="space-y-1.5">
                @for (task of week.tasks; track $index) {
                  <li class="flex items-start gap-2 text-sm">
                    <input type="checkbox" class="mt-1 accent-[var(--green-deep)]"
                      [checked]="isTaskDone($index)" (change)="toggleTask($index, $event)" />
                    <span [class.line-through]="isTaskDone($index)" [class.text-txt-mute]="isTaskDone($index)">{{ task }}</span>
                  </li>
                }
              </ul>
            </div>
            <p class="sm:col-span-2 text-sm"><span class="text-txt-mute">Outcome:</span> {{ week.expectedOutcome }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .wk { transition: border-color 0.2s var(--ease), background 0.2s var(--ease); }
      .wk-current { background: color-mix(in oklch, var(--peri) 6%, transparent); }
      .wk-done { border-color: color-mix(in oklch, var(--green) 40%, var(--paper-3)); }
      .wk-tag {
        display: inline-flex; align-items: center; padding: 1px 7px; border-radius: 100px;
        font-size: 9.5px; letter-spacing: 0.04em;
        background: color-mix(in oklch, var(--peri) 18%, transparent); color: var(--peri-deep);
      }
      .wk-tag-done { background: color-mix(in oklch, var(--green) 18%, transparent); color: var(--green-deep); }
      /* The timeline node: completed pops with a drawn check; the current week's node breathes. */
      .wk-node { transition: background 0.2s var(--ease), border-color 0.2s var(--ease); }
      .wk-node-done { animation: astaSoftPop 0.4s var(--ease-spring); }
      .wk-node-current { animation: wkNodePulse 2.4s ease-in-out infinite; }
      @keyframes wkNodePulse {
        0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--peri) 40%, transparent); }
        50% { box-shadow: 0 0 0 5px color-mix(in oklch, var(--peri) 0%, transparent); }
      }
      .wk-check { stroke-dasharray: 24; stroke-dashoffset: 24; animation: wkCheck 0.4s var(--ease) 0.12s forwards; }
      @keyframes wkCheck { to { stroke-dashoffset: 0; } }
      .wk-current { box-shadow: 0 0 18px color-mix(in oklch, var(--peri) 14%, transparent); }
      /* Expanding a week cascades its sections in. */
      .wk-expand > * { animation: astaRevealUp 0.4s var(--ease) both; }
      .wk-expand > *:nth-child(2) { animation-delay: 0.06s; }
      .wk-expand > *:nth-child(3) { animation-delay: 0.12s; }
      .wk-expand > *:nth-child(4) { animation-delay: 0.18s; }
      .wk-tag { animation: astaSoftPop 0.35s var(--ease-spring) both; }
      @media (prefers-reduced-motion: reduce) {
        .wk-node-done, .wk-node-current, .wk-check, .wk-expand > *, .wk-tag { animation: none; stroke-dashoffset: 0; }
      }
    `,
  ],
})
export class WeekCardComponent {
  @Input({ required: true }) week!: RoadmapWeek;
  @Input() completed = false;
  @Input() isCurrent = false;
  @Input() completedTasks: string[] = [];
  @Output() weekToggle = new EventEmitter<boolean>();
  @Output() taskToggle = new EventEmitter<TaskToggle>();

  readonly open = signal(false);

  taskId(index: number): string {
    return `w${this.week.weekNumber}:t${index}`;
  }
  isTaskDone(index: number): boolean {
    return this.completedTasks.includes(this.taskId(index));
  }
  toggleWeek(ev: Event): void {
    ev.stopPropagation();
    this.weekToggle.emit(!this.completed);
  }
  toggleTask(index: number, ev: Event): void {
    this.taskToggle.emit({ taskId: this.taskId(index), completed: (ev.target as HTMLInputElement).checked });
  }
}
