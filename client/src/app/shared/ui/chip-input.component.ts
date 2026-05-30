import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/** Type-to-add chip multiselect with optional suggestions (DESIGN_SPEC §4.2). */
@Component({
  selector: 'asta-chip-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-2 mb-3">
      @for (item of items; track item) {
        <span class="pill" [style.borderColor]="accentVar">
          {{ item }}
          <button type="button" class="ml-1 text-txt-mute hover:text-txt" (click)="remove(item)" [attr.aria-label]="'Remove ' + item">✕</button>
        </span>
      } @empty {
        <span class="text-sm text-txt-mute">None added yet.</span>
      }
    </div>

    <input
      class="input"
      [placeholder]="placeholder"
      (keydown.enter)="addFromEvent($event); $event.preventDefault()"
      (blur)="addFromEvent($event)"
      #box
    />

    @if (suggestions.length) {
      <div class="flex flex-wrap gap-2 mt-3">
        @for (s of suggestions; track s) {
          @if (!items.includes(s)) {
            <button type="button" class="pill" (click)="add(s)" style="cursor:pointer">+ {{ s }}</button>
          }
        }
      </div>
    }
  `,
})
export class ChipInputComponent {
  @Input() items: string[] = [];
  @Input() suggestions: string[] = [];
  @Input() placeholder = 'Type and press Enter';
  @Input() accentVar = 'var(--green)';
  @Output() itemsChange = new EventEmitter<string[]>();

  add(value: string): void {
    const v = value.trim();
    if (v && !this.items.includes(v)) {
      this.items = [...this.items, v];
      this.itemsChange.emit(this.items);
    }
  }

  addFromEvent(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.value.trim()) {
      this.add(input.value);
      input.value = '';
    }
  }

  remove(item: string): void {
    this.items = this.items.filter((i) => i !== item);
    this.itemsChange.emit(this.items);
  }
}
