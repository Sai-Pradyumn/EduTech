import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { ToastTone } from '../../core/models';

/** Top-right toast stack with tone-colored left edge (DESIGN_SPEC §8). */
@Component({
  selector: 'asta-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-4 right-4 z-[1000] flex flex-col gap-2.5 w-[min(360px,calc(100vw-2rem))]" aria-live="polite">
      @for (t of toasts(); track t.id) {
        <div
          class="card flex items-start gap-3 px-4 py-3 shadow-md animate-[slidein_.35s_var(--ease-spring)]"
          [style.borderLeft]="'3px solid ' + edge(t.tone)"
        >
          <span class="mt-0.5 font-mono text-xs uppercase tracking-wider" [style.color]="edge(t.tone)">
            {{ t.tone }}
          </span>
          <span class="flex-1 text-sm">{{ t.message }}</span>
          <button class="text-txt-mute hover:text-txt" (click)="dismiss(t.id)" aria-label="Dismiss">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`@keyframes slidein { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }`],
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
  dismiss(id: number): void {
    this.svc.dismiss(id);
  }
}
