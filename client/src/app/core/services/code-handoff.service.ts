import { Injectable, signal } from '@angular/core';

export interface CodeHandoff {
  language: string;
  code: string;
}

/**
 * Carries a code snippet from a chat reply ("Run in Lab") to the practice panel, which picks it
 * up on init and drops it into Free Play. One-shot: `take()` consumes and clears it.
 */
@Injectable({ providedIn: 'root' })
export class CodeHandoffService {
  private readonly pending = signal<CodeHandoff | null>(null);

  set(handoff: CodeHandoff): void {
    this.pending.set(handoff);
  }

  /** Consume the pending snippet (returns it once, then clears). */
  take(): CodeHandoff | null {
    const v = this.pending();
    if (v) this.pending.set(null);
    return v;
  }
}
