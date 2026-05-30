import { Injectable, signal } from '@angular/core';

/**
 * Wrapper over the browser SpeechSynthesis API. Strips markdown/code so the
 * spoken output stays natural, exposes a `speaking` signal for orb animation,
 * and resolves `speak()` when the utterance finishes (or is cancelled), so the
 * voice state machine can advance from 'speaking' → 'success' deterministically.
 */
@Injectable({ providedIn: 'root' })
export class TextToSpeechService {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly speaking = signal(false);

  speak(input: string, opts: { rate?: number; pitch?: number } = {}): Promise<void> {
    const text = this.clean(input);
    if (!this.supported || !text) return Promise.resolve();

    return new Promise<void>((resolve) => {
      // Cancel anything in flight so speech never overlaps.
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 800));
      u.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      u.rate = opts.rate ?? 1.02;
      u.pitch = opts.pitch ?? 1;
      const done = () => {
        this.speaking.set(false);
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      this.speaking.set(true);
      window.speechSynthesis.speak(u);
    });
  }

  cancel(): void {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.speaking.set(false);
  }

  /** Reduce markdown/code/links to readable plain text. */
  private clean(md: string): string {
    return md
      .replace(/```[\s\S]*?```/g, ' (code block) ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/[#*_>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
