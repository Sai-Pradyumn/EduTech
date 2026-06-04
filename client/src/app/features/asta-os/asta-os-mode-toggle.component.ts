import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AstaMode, AstaModeService } from '../../core/services/asta-mode.service';

/**
 * Top-level experience switch: Classic ↔ Asta OS. Lives in the app topbar so it
 * is reachable from every screen. Persists via AstaModeService and navigates to
 * the matching landing surface. Designed as a premium segmented control rather
 * than a plain settings switch.
 */
@Component({
  selector: 'asta-os-mode-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" role="group" aria-label="App experience mode">
      @for (opt of options; track opt.mode) {
        <button
          type="button"
          class="seg-btn"
          [class.active]="mode.mode() === opt.mode"
          [attr.aria-pressed]="mode.mode() === opt.mode"
          (click)="select(opt.mode)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .seg {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: 999px;
        background: color-mix(in oklch, var(--paper-2) 60%, transparent);
        border: 1px solid var(--paper-3);
      }
      .seg-btn {
        font-size: 12.5px;
        font-weight: 600;
        padding: 5px 13px;
        border-radius: 999px;
        color: var(--text-mute);
        white-space: nowrap;
        transition: color .18s var(--ease), background .18s var(--ease), box-shadow .25s var(--ease);
      }
      .seg-btn:hover { color: var(--text-soft); }
      .seg-btn.active {
        color: #06100a;
        background: linear-gradient(135deg, var(--green), var(--green-deep));
        box-shadow: 0 0 14px color-mix(in oklch, var(--green) 45%, transparent);
      }
    `,
  ],
})
export class AstaOsModeToggleComponent {
  protected readonly mode = inject(AstaModeService);
  private readonly router = inject(Router);

  protected readonly options: { mode: AstaMode; label: string }[] = [
    { mode: 'classic', label: 'Classic' },
    { mode: 'os', label: 'Asta OS' },
  ];

  protected select(mode: AstaMode): void {
    if (this.mode.mode() === mode) return;
    this.mode.set(mode);
    if (mode === 'os') this.mode.requestIntro();
    void this.router.navigateByUrl(this.mode.landingRoute());
  }
}
