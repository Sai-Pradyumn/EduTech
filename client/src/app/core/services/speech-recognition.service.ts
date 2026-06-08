import { Injectable } from '@angular/core';

export interface RecognitionHandlers {
  /** Fired on every result; `isFinal` marks a settled phrase. */
  onResult: (text: string, isFinal: boolean) => void;
  /** Fired on a recognition error with the raw error code (e.g. 'not-allowed', 'no-speech'). */
  onError?: (code: string) => void;
  /** Fired when the recognition session ends (naturally or via stop/abort). */
  onEnd?: () => void;
  /** Fired the moment audio capture actually starts. */
  onStart?: () => void;
}

export interface RecognitionOptions extends RecognitionHandlers {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

/**
 * Thin wrapper over the Web Speech API (`SpeechRecognition` / vendor-prefixed
 * `webkitSpeechRecognition`). Only one recognition runs at a time — `start()`
 * tears down any previous instance first — so the wake-word listener and the
 * one-shot command capture never fight over the microphone. Loosely typed for
 * portability across browsers that don't ship lib.dom types for this API.
 */
@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  readonly supported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  private rec: any;
  /** True while a session is live — guards against double starts. */
  private active = false;

  start(opts: RecognitionOptions): void {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      opts.onError?.('unsupported');
      return;
    }
    // Replace any in-flight session cleanly before opening a new one.
    this.stop();

    const rec = new Ctor();
    rec.lang = opts.lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';
    rec.continuous = opts.continuous ?? false;
    rec.interimResults = opts.interimResults ?? false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.active = true;
      opts.onStart?.();
    };
    rec.onresult = (ev: any) => {
      const results = ev.results as ArrayLike<any>;
      // Walk only the results from this event's resultIndex forward.
      for (let i = ev.resultIndex; i < results.length; i++) {
        const r = results[i];
        const text = (r[0]?.transcript ?? '').trim();
        if (text) opts.onResult(text, !!r.isFinal);
      }
    };
    rec.onerror = (ev: any) => opts.onError?.(ev?.error ?? 'error');
    rec.onend = () => {
      this.active = false;
      opts.onEnd?.();
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      // start() throws if called while already started — treat as a no-op.
      this.active = false;
    }
  }

  /** Stop gracefully — fires a final result then `onend`. */
  stop(): void {
    if (!this.rec) return;
    try {
      this.rec.stop();
    } catch {
      /* already stopped */
    }
  }

  /** Hard cancel — drops audio without emitting a final result. */
  abort(): void {
    if (!this.rec) return;
    try {
      this.rec.abort();
    } catch {
      /* already aborted */
    }
    this.active = false;
  }

  get listening(): boolean {
    return this.active;
  }
}
