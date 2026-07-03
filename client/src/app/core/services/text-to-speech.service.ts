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

  private longSession = 0;

  /**
   * Speak arbitrarily long text (utterances are capped at ~800 chars) by
   * splitting into sentence groups and speaking them in sequence. `cancel()`
   * or a newer speakLong call stops the remaining queue.
   */
  async speakLong(input: string, opts: { rate?: number } = {}): Promise<void> {
    const text = this.clean(input);
    if (!this.supported || !text) return;
    const session = ++this.longSession;
    for (const part of this.splitSentences(text, 700)) {
      if (session !== this.longSession) return; // cancelled or superseded
      await this.speak(part, opts);
    }
  }

  cancel(): void {
    this.longSession++;
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.speaking.set(false);
  }

  /** Group whole sentences into chunks of at most `max` characters. */
  private splitSentences(text: string, max: number): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
    const parts: string[] = [];
    let current = '';
    for (const s of sentences) {
      if (current && (current + s).length > max) {
        parts.push(current);
        current = s;
      } else {
        current += s;
      }
    }
    if (current.trim()) parts.push(current);
    return parts;
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
