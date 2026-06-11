import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';

/**
 * Modal dialog (DESIGN_SPEC §4.2 / §8). Backdrop blur, spring scale-in, ESC +
 * backdrop close, projected content. Controlled via `[open]` / `(closed)`.
 *
 * Usage:
 *   <asta-modal [open]="show()" (closed)="show.set(false)">
 *     <h3>Title</h3> ...
 *   </asta-modal>
 */
@Component({
  selector: 'asta-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <!-- Backdrop click is a mouse convenience; keyboard users close via ESC (document:keydown.escape below). -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <div class="backdrop" [class.top]="align === 'top'" (click)="backdropClose()">
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
        <div
          #panel
          class="panel"
          [style.maxWidth.px]="maxWidth"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: grid;
        place-items: center;
        padding: 20px;
        background: color-mix(in oklch, var(--ink) 48%, transparent);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        animation: fade 0.2s var(--ease);
      }
      .backdrop.top { place-items: start center; padding-top: 12vh; }
      /* Glass sheet: corner light-bloom + translucent paper + blur — same surface
         language as the auth form card and toasts. */
      .panel {
        width: 100%;
        max-width: 520px;
        background:
          radial-gradient(140% 90% at 0% 0%, color-mix(in oklch, var(--paper-2) 65%, transparent), transparent 56%),
          color-mix(in oklch, var(--paper) 92%, transparent);
        border: 1px solid color-mix(in oklch, var(--paper-3) 85%, transparent);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-lg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        padding: 28px;
        max-height: 86vh;
        overflow: auto;
        animation: pop 0.32s var(--ease-spring);
      }
      @keyframes fade { from { opacity: 0; } }
      @keyframes pop { from { opacity: 0; transform: scale(0.94) translateY(8px); } }
      @media (prefers-reduced-motion: reduce) {
        .backdrop, .panel { animation: none; }
      }
    `,
  ],
})
export class ModalComponent implements OnChanges {
  @Input() open = false;
  @Input() maxWidth = 520;
  @Input() align: 'center' | 'top' = 'center';
  /** Allow clicking the backdrop to close. */
  @Input() dismissable = true;
  @Output() closed = new EventEmitter<void>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private previouslyFocused: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open) {
      // Remember what had focus, then move focus into the dialog (a11y §9).
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      setTimeout(() => {
        const panel = this.host.nativeElement.querySelector<HTMLElement>('.panel');
        (this.focusables(panel)[0] ?? panel)?.focus();
      });
    } else {
      // Restore focus to the trigger when the dialog closes.
      this.previouslyFocused?.focus?.();
      this.previouslyFocused = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open && this.dismissable) this.closed.emit();
  }

  /** Trap Tab within the dialog while open. */
  @HostListener('document:keydown.Tab', ['$event'])
  @HostListener('document:keydown.shift.Tab', ['$event'])
  onTab(e: KeyboardEvent): void {
    if (!this.open) return;
    const panel = this.host.nativeElement.querySelector<HTMLElement>('.panel');
    const items = this.focusables(panel);
    if (!items.length) {
      e.preventDefault();
      panel?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  backdropClose(): void {
    if (this.dismissable) this.closed.emit();
  }

  private focusables(root: HTMLElement | null): HTMLElement[] {
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  }
}
