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
      <span class="absolute left-0 top-1.5 grid place-items-center rounded-full"
        style="width:18px;height:18px"
        [style.background]="completed ? 'var(--green)' : 'var(--paper)'"
        [style.border]="'2px solid ' + (completed ? 'var(--green)' : isCurrent ? 'var(--peri)' : 'var(--paper-3)')">
        @if (completed) {
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        }
      </span>

      <div class="card mb-3" [style.borderColor]="isCurrent ? 'var(--peri)' : null" style="padding:16px 18px">
        <button type="button" class="w-full flex items-center justify-between gap-3 text-left" (click)="open.set(!open())">
          <div class="min-w-0">
            <p class="font-mono text-[11px] uppercase tracking-wider text-txt-mute">Week {{ week.weekNumber }}</p>
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
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
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
