import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  inject,
  signal,
} from '@angular/core';
import { OfflineResourceKind, OfflineService } from '../../core/services/offline.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * "Make available offline" toggle (Phase 10 · M4). Drop onto any resource page:
 *   <asta-offline-toggle kind="roadmap" [refId]="id" [title]="title" [payload]="data" />
 * Saves a read-only snapshot to IndexedDB (or removes it) so the learner can study offline.
 */
@Component({
  selector: 'asta-offline-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
      [style.background]="saved() ? 'var(--green)' : 'var(--paper-2)'"
      [style.color]="saved() ? 'var(--ink)' : 'var(--text-soft)'"
      [disabled]="busy()"
      (click)="toggle()"
      [attr.aria-pressed]="saved()"
      title="Save a read-only copy for offline study"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        @if (saved()) { <path d="M20 6 9 17l-5-5" /> } @else { <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /> }
      </svg>
      {{ saved() ? 'Available offline' : 'Make available offline' }}
    </button>
  `,
})
export class OfflineToggleComponent implements OnChanges {
  private readonly offline = inject(OfflineService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) kind!: OfflineResourceKind;
  @Input({ required: true }) refId!: string;
  @Input({ required: true }) title!: string;
  @Input() payload: unknown;

  readonly saved = signal(false);
  readonly busy = signal(false);

  ngOnChanges(): void {
    if (this.refId) {
      void this.offline
        .isSaved(this.kind, this.refId)
        .then((s) => this.saved.set(s));
    }
  }

  async toggle(): Promise<void> {
    this.busy.set(true);
    try {
      if (this.saved()) {
        await this.offline.removeResource(`${this.kind}:${this.refId}`);
        this.saved.set(false);
        this.toast.info('Removed from offline');
      } else {
        await this.offline.saveResource(this.kind, this.refId, this.title, this.payload);
        this.saved.set(true);
        this.toast.success('Saved for offline study');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
