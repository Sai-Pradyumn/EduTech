import { Injectable, signal } from '@angular/core';
import { Toast, ToastTone } from '../models';

/** Global toast stack (DESIGN_SPEC §8). Auto-dismiss after 4s. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, tone: ToastTone = 'info'): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, tone, message }]);
    setTimeout(() => this.dismiss(id), 4000);
  }

  success(message: string): void {
    this.show(message, 'success');
  }
  error(message: string): void {
    this.show(message, 'danger');
  }
  info(message: string): void {
    this.show(message, 'info');
  }
  warning(message: string): void {
    this.show(message, 'warning');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
