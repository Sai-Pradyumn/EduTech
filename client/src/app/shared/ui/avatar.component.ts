import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { AgentAccent, ACCENT_VAR } from '../../core/constants/agents';

/** Square-rounded for agents, circle for people (DESIGN_SPEC §4.1). */
@Component({
  selector: 'asta-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-grid place-items-center font-display font-semibold leading-none text-ink"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.fontSize.px]="size * 0.42"
      [style.borderRadius]="square ? 'var(--r-sm)' : '999px'"
      [style.background]="bg()"
    >
      {{ initial() }}
    </span>
  `,
})
export class AvatarComponent {
  @Input() set name(v: string) {
    this.nameSig.set(v);
  }
  @Input() size = 36;
  @Input() square = false;
  @Input() accent: AgentAccent | null = null;

  private readonly nameSig = signal('A');
  readonly initial = computed(() => (this.nameSig().trim()[0] ?? 'A').toUpperCase());

  bg(): string {
    return this.accent ? ACCENT_VAR[this.accent] : 'oklch(0.88 0.04 150)';
  }
}
