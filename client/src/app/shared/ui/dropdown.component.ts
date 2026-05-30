import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  inject,
  signal,
} from '@angular/core';

/**
 * Generic dropdown / popover menu. Project a trigger (slot `[ddTrigger]`) and the
 * panel content (default slot). Closes on outside-click and ESC.
 *
 * Usage:
 *   <asta-dropdown align="right">
 *     <button ddTrigger>⋯</button>
 *     <a class="dd-item">Settings</a>
 *     <a class="dd-item">Logout</a>
 *   </asta-dropdown>
 */
@Component({
  selector: 'asta-dropdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dd-trigger" (click)="toggle()"><ng-content select="[ddTrigger]" /></div>
    @if (open()) {
      <div class="dd-panel" [class.right]="align === 'right'">
        <ng-content />
      </div>
    }
  `,
  styles: [
    `
      :host { position: relative; display: inline-flex; }
      .dd-trigger { display: inline-flex; cursor: pointer; }
      .dd-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        min-width: 200px;
        z-index: 60;
        padding: 6px;
        background: var(--paper);
        border: 1px solid var(--paper-3);
        border-radius: var(--r-sm);
        box-shadow: var(--shadow-lg);
        animation: ddIn 0.18s var(--ease-spring);
      }
      .dd-panel.right { left: auto; right: 0; }
      @keyframes ddIn { from { opacity: 0; transform: translateY(-6px) scale(0.98); } }
      @media (prefers-reduced-motion: reduce) { .dd-panel { animation: none; } }

      ::ng-deep .dd-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 9px 11px;
        border-radius: var(--r-xs);
        font-size: 14.5px;
        color: var(--text-soft);
        cursor: pointer;
        border: 0;
        background: transparent;
        text-align: left;
        transition: background 0.15s var(--ease), color 0.15s var(--ease);
      }
      ::ng-deep .dd-item:hover { background: var(--paper-2); color: var(--text); }
      ::ng-deep .dd-sep { height: 1px; background: var(--paper-3); margin: 6px 4px; }
    `,
  ],
})
export class DropdownComponent {
  @Input() align: 'left' | 'right' = 'left';
  readonly open = signal(false);
  private readonly el = inject(ElementRef<HTMLElement>);

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.open() && !this.el.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }
}
