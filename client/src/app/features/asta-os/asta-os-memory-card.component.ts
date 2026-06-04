import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AstaMemorySuggestion } from '../../core/models';

/**
 * "Asta wants to remember…" confirmation card. Nothing is saved until the learner
 * confirms; Edit lets them refine the wording first. Emits the (possibly edited)
 * suggestion on save, or a bare dismiss. Calm, non-blocking, noir-styled.
 */
@Component({
  selector: 'asta-os-memory-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="card" [class.saving]="saving()">
      <div class="ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5c0 1.5.5 2.5 1.5 3.5M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.5-1.5 3.5M9 22h6M10 22v-4a2 2 0 0 1 4 0v4M12 11v3" /></svg>
      </div>
      <div class="body">
        <p class="kick">Asta wants to remember</p>
        @if (editing()) {
          <input class="edit" [(ngModel)]="draft" (keydown.enter)="confirmEdit()" aria-label="Edit what Asta remembers" />
        } @else {
          <p class="line">{{ suggestion().summary }}</p>
        }
        <div class="actions">
          @if (editing()) {
            <button type="button" class="btn primary" (click)="confirmEdit()" [disabled]="saving()">Save</button>
            <button type="button" class="btn ghost" (click)="editing.set(false)" [disabled]="saving()">Cancel</button>
          } @else {
            <button type="button" class="btn primary" (click)="save.emit(suggestion())" [disabled]="saving()">Save</button>
            <button type="button" class="btn ghost" (click)="startEdit()" [disabled]="saving()">Edit</button>
            <button type="button" class="btn ghost" (click)="dismiss.emit()" [disabled]="saving()">Not now</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .card { display: flex; gap: 12px; padding: 14px 16px; border-radius: 16px; background: var(--asta-panel); border: 1px solid color-mix(in srgb, var(--asta-gold) 30%, var(--asta-border)); }
      .card.saving { opacity: .6; }
      .ico { flex-shrink: 0; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: var(--asta-gold); background: color-mix(in srgb, var(--asta-gold) 12%, transparent); }
      .body { flex: 1; min-width: 0; }
      .kick { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-gold); margin-bottom: 5px; }
      .line { font-size: 14.5px; color: var(--asta-text); }
      .edit { width: 100%; font-size: 14.5px; color: var(--asta-text); background: var(--asta-bg-soft); border: 1px solid var(--asta-border); border-radius: 9px; padding: 7px 10px; outline: none; }
      .edit:focus { border-color: color-mix(in srgb, var(--asta-green) 50%, transparent); }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
      .btn { font-size: 12.5px; font-weight: 600; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--asta-border); color: var(--asta-muted); transition: transform .14s ease, color .14s ease; }
      .btn:disabled { opacity: .5; cursor: default; }
      .btn.primary { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); border-color: transparent; }
      .btn.ghost:not(:disabled):hover { color: var(--asta-text); transform: translateY(-1px); }
    `,
  ],
})
export class AstaOsMemoryCardComponent {
  readonly suggestion = input.required<AstaMemorySuggestion>();
  readonly saving = input(false);

  readonly save = output<AstaMemorySuggestion>();
  readonly dismiss = output<void>();

  protected readonly editing = signal(false);
  protected draft = '';

  protected startEdit(): void {
    this.draft = this.suggestion().summary;
    this.editing.set(true);
  }

  protected confirmEdit(): void {
    const summary = this.draft.trim();
    if (!summary) return;
    this.editing.set(false);
    this.save.emit({ ...this.suggestion(), value: summary, summary });
  }
}
