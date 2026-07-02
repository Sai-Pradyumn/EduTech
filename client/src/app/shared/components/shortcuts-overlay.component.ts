import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';
import { ModalComponent } from '../ui/modal.component';

interface Shortcut { keys: string[]; label: string; }

/**
 * Global keyboard-shortcuts help (press `?`). Lists the app-wide shortcuts and
 * the command-palette keys. Mounted once in AppComponent next to the palette.
 */
@Component({
    selector: 'asta-shortcuts-overlay',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ModalComponent],
    template: `
    <asta-modal [open]="open()" [maxWidth]="460" (closed)="open.set(false)">
      @if (open()) {
        <h3 class="font-display text-xl mb-1">Keyboard shortcuts</h3>
        <p class="text-sm text-txt-mute mb-4">Work faster across Asta.</p>
        <div class="sc-list">
          @for (s of shortcuts; track s.label) {
            <div class="sc-row">
              <span class="sc-label">{{ s.label }}</span>
              <span class="sc-keys">@for (k of s.keys; track k) { <kbd>{{ k }}</kbd> }</span>
            </div>
          }
        </div>
      }
    </asta-modal>
  `,
    styles: [`
    .sc-list { display: flex; flex-direction: column; gap: 2px; }
    .sc-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 4px; border-bottom: 1px solid var(--paper-2); animation: astaRevealUp 0.35s var(--ease) both; }
    .sc-row:nth-child(2) { animation-delay: 0.05s; }
    .sc-row:nth-child(3) { animation-delay: 0.1s; }
    .sc-row:nth-child(4) { animation-delay: 0.15s; }
    .sc-row:nth-child(5) { animation-delay: 0.2s; }
    .sc-row:last-child { border-bottom: 0; }
    @media (prefers-reduced-motion: reduce) { .sc-row { animation: none; } }
    .sc-label { font-size: 14px; color: var(--text); }
    .sc-keys { display: flex; gap: 4px; flex-shrink: 0; }
    kbd { font-family: var(--mono); font-size: 11px; padding: 2px 7px; border: 1px solid var(--paper-3); border-radius: 6px; background: var(--paper-2); color: var(--text-soft); }
  `]
})
export class ShortcutsOverlayComponent {
  readonly open = signal(false);

  private readonly mod = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
  readonly shortcuts: Shortcut[] = [
    { keys: [this.mod, 'K'], label: 'Open command palette — jump to any page' },
    { keys: ['?'], label: 'Show this shortcuts help' },
    { keys: ['Esc'], label: 'Close dialogs, the palette or this help' },
    { keys: ['↑', '↓'], label: 'Move through palette results' },
    { keys: ['↵'], label: 'Open the selected palette result' },
    { keys: [this.mod, 'K'], label: 'Asta OS — focus the composer' },
    { keys: ['Esc'], label: 'Asta OS — close search, exit focus mode' },
    { keys: ['Esc'], label: 'AI Tutor — exit large-screen view' },
  ];

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
    // Ignore while typing in a field.
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    e.preventDefault();
    this.open.update((v) => !v);
  }
}
