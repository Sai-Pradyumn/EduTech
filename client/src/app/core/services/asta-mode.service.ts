import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

/** The two top-level product experiences. */
export type AstaMode = 'classic' | 'os';

const STORAGE_KEY = 'asta.mode';

/**
 * Top-level experience controller: `classic` (the existing screen-based app) vs
 * `os` (the AI-first Asta OS cockpit). The choice persists in localStorage and
 * drives the `/app` landing redirect (see asta-mode-redirect.guard) and the
 * topbar mode toggle. Mirrors the persistence idiom of ThemeService.
 *
 * Default is `classic` so existing users are never disrupted until they opt in.
 */
@Injectable({ providedIn: 'root' })
export class AstaModeService {
  private readonly doc = inject(DOCUMENT);

  readonly mode = signal<AstaMode>(this.read());

  /** Set when the learner deliberately enters Asta OS (toggle) — triggers the grand opening. */
  private introPending = false;
  /** True until the cockpit mounts the first time this page-load (direct OS open also gets the intro). */
  private firstOsMount = true;

  constructor() {
    effect(() => {
      const mode = this.mode();
      try {
        this.doc.defaultView?.localStorage?.setItem(STORAGE_KEY, mode);
      } catch {
        /* storage unavailable — keep in-memory only */
      }
    });
  }

  set(mode: AstaMode): void {
    this.mode.set(mode);
  }

  toggle(): void {
    this.mode.set(this.mode() === 'os' ? 'classic' : 'os');
  }

  /** The route a user in this mode should land on from the `/app` root. */
  landingRoute(): string {
    return this.mode() === 'os' ? '/app/os' : '/app/dashboard';
  }

  /** Ask the cockpit to play its grand opening on next mount (called when toggling into OS). */
  requestIntro(): void {
    this.introPending = true;
  }

  /** Returns true once when the cockpit should play the grand opening (toggle, or first direct open). */
  consumeIntro(): boolean {
    const play = this.introPending || this.firstOsMount;
    this.introPending = false;
    this.firstOsMount = false;
    return play;
  }

  private read(): AstaMode {
    try {
      const v = this.doc.defaultView?.localStorage?.getItem(STORAGE_KEY);
      if (v === 'classic' || v === 'os') return v;
    } catch {
      /* ignore */
    }
    return 'classic';
  }
}
