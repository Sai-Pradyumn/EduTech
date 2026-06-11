import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { ToastTone } from '../../core/models';

/**
 * Top-right toast stack (DESIGN_SPEC §8). Glass sheets with a tone icon chip —
 * the glyph carries the tone at a glance (the message itself is what the
 * aria-live region announces), spring entrance per toast.
 */
@Component({
  selector: 'asta-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-4 right-4 z-[1000] flex flex-col gap-2.5 w-[min(360px,calc(100vw-2rem))]" aria-live="polite">
      @for (t of toasts(); track t.id) {
        <div class="toast flex items-start gap-3 px-4 py-3" [style.--tone]="edge(t.tone)">
          <span class="tone-ico" aria-hidden="true">{{ icon(t.tone) }}</span>
          <span class="flex-1 text-sm pt-0.5">{{ t.message }}</span>
          <button class="toast-x" (click)="dismiss(t.id)" aria-label="Dismiss">✕</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast {
        border-radius: var(--r-md);
        background:
          radial-gradient(120% 100% at 0% 0%, color-mix(in oklch, var(--tone) 10%, transparent), transparent 60%),
          color-mix(in oklch, var(--paper) 86%, transparent);
        border: 1px solid color-mix(in oklch, var(--tone) 26%, var(--paper-3));
        box-shadow: var(--shadow-md);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        animation: toastIn 0.4s var(--ease-spring) both;
      }
      .tone-ico {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--tone);
        background: color-mix(in oklch, var(--tone) 15%, transparent);
      }
      .toast-x {
        color: var(--text-mute);
        font-size: 12px;
        padding: 2px 4px;
        border-radius: 6px;
        transition: color 0.15s var(--ease);
      }
      .toast-x:hover { color: var(--text); }
      @keyframes toastIn {
        from { transform: translateX(24px) scale(0.97); opacity: 0; }
        to { transform: none; opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .toast { animation: none; }
      }
    `,
  ],
})
export class ToastContainerComponent {
  private readonly svc = inject(ToastService);
  readonly toasts = this.svc.toasts;

  edge(tone: ToastTone): string {
    return {
      success: 'var(--green-deep)',
      info: 'var(--peri-deep)',
      warning: 'var(--coral-deep)',
      danger: 'var(--danger)',
    }[tone];
  }

  icon(tone: ToastTone): string {
    return { success: '✓', info: 'i', warning: '!', danger: '✕' }[tone];
  }

  dismiss(id: number): void {
    this.svc.dismiss(id);
  }
}
