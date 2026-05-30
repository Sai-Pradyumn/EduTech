import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'asta.theme';

/**
 * App theme controller. Mode is `light | dark | system`; the *resolved* theme
 * (light/dark) is written as `data-theme` on <html>, which flips every CSS
 * token (see styles.css `:root[data-theme="dark"]`). A tiny inline script in
 * index.html sets the attribute pre-paint to avoid a flash; this service keeps
 * it in sync at runtime and persists the choice.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  readonly mode = signal<ThemeMode>(this.read());
  private readonly systemDark = signal(this.matchSystemDark());

  /** The effective theme actually applied. */
  readonly resolved = computed<'light' | 'dark'>(() => {
    const m = this.mode();
    return m === 'system' ? (this.systemDark() ? 'dark' : 'light') : m;
  });

  constructor() {
    const win = this.doc.defaultView;
    const mq = win?.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const resolved = this.resolved();
      this.doc.documentElement.setAttribute('data-theme', resolved);
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      this.doc.defaultView?.localStorage?.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }

  /** Cycle system → light → dark → system. */
  cycle(): void {
    const next: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
    this.set(next[this.mode()]);
  }

  private read(): ThemeMode {
    try {
      const v = this.doc.defaultView?.localStorage?.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      /* ignore */
    }
    return 'system';
  }

  private matchSystemDark(): boolean {
    return this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
