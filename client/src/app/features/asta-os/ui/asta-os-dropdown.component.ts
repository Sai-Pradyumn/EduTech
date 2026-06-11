import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface AstaDropdownOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
  /** Inline SVG path data (24×24), optional. */
  readonly icon?: string;
}

/**
 * Reusable noir select-style dropdown for Asta OS. A real value-picker (not a
 * menu): shows the selected label, opens a keyboard-navigable list, closes on
 * outside-click/Esc. Fully accessible (listbox semantics). Used across the
 * cockpit and playground in place of native <select> for a consistent feel.
 */
@Component({
  selector: 'asta-os-dropdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="trigger"
      [class.compact]="compact()"
      [disabled]="disabled()"
      (click)="toggle()"
      (keydown)="onTriggerKey($event)"
      [attr.aria-expanded]="open()"
      aria-haspopup="listbox"
      [attr.aria-label]="ariaLabel()"
    >
      @if (selected()?.icon; as ic) {
        <svg class="lead" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="ic" /></svg>
      }
      <span class="val">{{ selected()?.label ?? placeholder() }}</span>
      <svg class="caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class.up]="open()"><path d="m6 9 6 6 6-6" /></svg>
    </button>

    @if (open()) {
      <ul class="panel" role="listbox" [attr.aria-activedescendant]="'opt-' + active()" [class.up]="dropUp()">
        @for (o of options(); track o.value; let i = $index) {
          <!-- Keyboard selection is handled on the trigger via onTriggerKey (arrow keys + Enter, aria-activedescendant); option click is a mouse convenience. -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li
            [id]="'opt-' + i"
            role="option"
            class="opt"
            [class.sel]="o.value === value()"
            [class.act]="i === active()"
            [attr.aria-selected]="o.value === value()"
            (click)="choose(o)"
            (mouseenter)="active.set(i)"
          >
            @if (o.icon; as ic) {
              <svg class="oic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="ic" /></svg>
            }
            <span class="otext">
              <span class="olabel">{{ o.label }}</span>
              @if (o.hint) { <span class="ohint">{{ o.hint }}</span> }
            </span>
            @if (o.value === value()) {
              <svg class="ok" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host { position: relative; display: inline-flex; }
      .trigger { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px; background: var(--asta-panel); border: 1px solid var(--asta-border); color: var(--asta-text); font-size: 12.5px; font-weight: 600; max-width: 100%; transition: border-color .16s ease, background .16s ease; }
      .trigger.compact { padding: 5px 10px; font-size: 12px; }
      .trigger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .trigger:focus-visible { outline: 2px solid color-mix(in srgb, var(--asta-green) 55%, transparent); outline-offset: 2px; }
      .trigger:disabled { opacity: .5; cursor: default; }
      .lead { color: var(--asta-green); flex-shrink: 0; }
      .val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .caret { color: var(--asta-muted); flex-shrink: 0; transition: transform .18s ease; }
      .caret.up { transform: rotate(180deg); }

      .panel { position: absolute; z-index: 70; top: calc(100% + 6px); left: 0; min-width: 220px; max-width: 320px; max-height: 320px; overflow-y: auto; padding: 6px; border-radius: 14px; background: var(--asta-bg-elevated); border: 1px solid var(--asta-border); box-shadow: 0 24px 60px rgba(0,0,0,.5); animation: ddIn .16s ease; }
      .panel.up { top: auto; bottom: calc(100% + 6px); }
      @keyframes ddIn { from { opacity: 0; transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }

      .opt { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; cursor: pointer; color: var(--asta-muted); }
      .opt.act { background: var(--asta-panel); color: var(--asta-text); }
      .opt.sel { color: var(--asta-text); }
      .oic { color: var(--asta-green); flex-shrink: 0; }
      .otext { display: flex; flex-direction: column; line-height: 1.25; flex: 1; min-width: 0; }
      .olabel { font-size: 13px; font-weight: 600; }
      .ohint { font-size: 11.5px; color: var(--asta-subtle); }
      .ok { color: var(--asta-green); flex-shrink: 0; }
    `,
  ],
})
export class AstaOsDropdownComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input.required<readonly AstaDropdownOption[]>();
  readonly value = input.required<string>();
  readonly placeholder = input('Select…');
  readonly ariaLabel = input('Select an option');
  readonly disabled = input(false);
  readonly compact = input(false);

  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly dropUp = signal(false);

  protected readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.active.set(Math.max(0, this.options().findIndex((o) => o.value === this.value())));
    this.dropUp.set(this.host.nativeElement.getBoundingClientRect().bottom > window.innerHeight - 340);
    this.open.set(true);
  }

  protected choose(o: AstaDropdownOption): void {
    this.valueChange.emit(o.value);
    this.open.set(false);
  }

  protected onTriggerKey(e: KeyboardEvent): void {
    if (['ArrowDown', 'Enter', ' '].includes(e.key) && !this.open()) {
      e.preventDefault();
      this.toggle();
    }
  }

  @HostListener('keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (!this.open()) return;
    const opts = this.options();
    if (e.key === 'Escape') {
      e.preventDefault();
      this.open.set(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.set((this.active() + 1) % opts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.set((this.active() - 1 + opts.length) % opts.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = opts[this.active()];
      if (o) this.choose(o);
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
