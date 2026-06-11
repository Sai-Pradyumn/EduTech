import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

/**
 * Debounced search input with a leading icon and a clear button.
 * Emits `valueChange` after `debounceMs`. `autofocus` focuses on init.
 *
 * Usage: <asta-search placeholder="Search…" (valueChange)="q.set($event)" />
 */
@Component({
  selector: 'asta-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        #input
        type="text"
        [value]="value()"
        [placeholder]="placeholder"
        (input)="onInput($event)"
        (keydown)="keydown.emit($event)"
        autocomplete="off"
        spellcheck="false"
      />
      @if (value()) {
        <button type="button" class="clear" (click)="clear()" aria-label="Clear">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      }
    </div>
  `,
  styles: [
    `
      .search {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 14px;
        border-radius: var(--r-sm);
        border: 1px solid var(--paper-3);
        background: var(--paper);
        color: var(--text-mute);
        transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
      }
      .search:focus-within {
        border-color: var(--peri);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--peri) 16%, transparent);
      }
      input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        font-family: var(--body);
        font-size: 15px;
        color: var(--text);
      }
      input::placeholder { color: var(--text-mute); }
      .clear {
        display: grid;
        place-items: center;
        color: var(--text-mute);
        cursor: pointer;
        border: 0;
        background: transparent;
      }
      .clear:hover { color: var(--text); }
    `,
  ],
})
export class SearchComponent implements AfterViewInit {
  @Input() placeholder = 'Search…';
  @Input() debounceMs = 180;
  @Input() autofocus = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() keydown = new EventEmitter<KeyboardEvent>();

  @ViewChild('input') inputRef?: ElementRef<HTMLInputElement>;
  readonly value = signal('');
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    if (this.autofocus) queueMicrotask(() => this.inputRef?.nativeElement.focus());
  }

  onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.valueChange.emit(v), this.debounceMs);
  }

  clear(): void {
    this.value.set('');
    this.valueChange.emit('');
    this.inputRef?.nativeElement.focus();
  }

  focus(): void {
    this.inputRef?.nativeElement.focus();
  }
}
