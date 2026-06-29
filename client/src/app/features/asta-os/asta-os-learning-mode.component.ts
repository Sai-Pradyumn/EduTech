import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LEARNING_MODES } from './asta-os.constants';
import { AstaLearningMode } from './asta-os.types';
import { AstaDropdownOption, AstaOsDropdownComponent } from './ui/asta-os-dropdown.component';

const BRAIN_ICON = 'M12 2a5 5 0 0 0-5 5c0 1.5.5 2.5 1.5 3.5M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.5-1.5 3.5M9 22h6M10 22v-4a2 2 0 0 1 4 0v4M12 11v3';

/**
 * Picks how Asta teaches this session. Each option maps to a real backend
 * TutorMode, so Hint-first / Socratic genuinely make Asta guide instead of
 * handing over answers. Uses the shared Asta OS dropdown.
 */
@Component({
    selector: 'asta-os-learning-mode',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AstaOsDropdownComponent],
    template: `
    <asta-os-dropdown
      [options]="options()"
      [value]="active()"
      ariaLabel="How Asta teaches this session"
      (valueChange)="change.emit($any($event))"
    />
  `
})
export class AstaOsLearningModeComponent {
  readonly active = input.required<AstaLearningMode>();
  readonly change = output<AstaLearningMode>();

  protected readonly options = computed<AstaDropdownOption[]>(() =>
    LEARNING_MODES.map((m) => ({
      value: m.mode,
      label: m.label,
      hint: m.guiding ? 'Guides you, no direct answers' : undefined,
      icon: BRAIN_ICON,
    })),
  );
}
