import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

export interface ComposerSubmit {
  text: string;
  files: File[];
}

/**
 * Universal smart composer — the shared AI input used across surfaces (agent
 * workspaces, AI dock). Auto-grow textarea, Enter-to-send / Shift+Enter newline,
 * custom file-upload (button + drag/drop, removable chips) and mic dictation
 * (Web Speech API, graceful fallback). Presentational: manages its own draft and
 * attachments, emits `(submit)` with `{ text, files }`.
 */
@Component({
  selector: 'asta-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="composer" [class.drag]="dragging()" (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
      @if (files().length) {
        <div class="chips">
          @for (f of files(); track f.name + f.size) {
            <span class="chip">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              <span class="chip-name">{{ f.name }}</span>
              <button type="button" (click)="removeFile(f)" aria-label="Remove">×</button>
            </span>
          }
        </div>
      }

      <div class="row">
        <button type="button" class="icon-btn" (click)="fileInput.click()" [disabled]="disabled" title="Attach files" aria-label="Attach files">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.05-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" /></svg>
        </button>
        <input #fileInput type="file" multiple hidden (change)="onFiles($event)" />

        <textarea
          #ta
          class="ta"
          rows="1"
          [value]="draft()"
          [disabled]="disabled"
          [placeholder]="placeholder"
          (input)="onInput($event)"
          (keydown)="onKey($event)"
        ></textarea>

        @if (micSupported) {
          <button type="button" class="icon-btn" [class.rec]="recording()" (click)="toggleMic()" [disabled]="disabled" title="Dictate" aria-label="Dictate">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
        }

        <button type="button" class="send" (click)="submitNow()" [disabled]="disabled || !canSend()" aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .composer {
        border: 1px solid var(--paper-3);
        border-radius: var(--r-md);
        background: var(--paper);
        padding: 8px 8px 8px 10px;
        transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
      }
      .composer:focus-within { border-color: var(--peri); box-shadow: 0 0 0 3px color-mix(in oklch, var(--peri) 15%, transparent); }
      .composer.drag { border-color: var(--green); box-shadow: 0 0 0 3px color-mix(in oklch, var(--green) 20%, transparent); }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 2px 8px; }
      .chip {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; color: var(--text-soft);
        background: var(--paper-2); border: 1px solid var(--paper-3);
        padding: 4px 8px; border-radius: 100px; max-width: 220px;
      }
      .chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chip button { color: var(--text-mute); font-size: 15px; line-height: 1; cursor: pointer; border: 0; background: transparent; }
      .chip button:hover { color: var(--danger); }
      .row { display: flex; align-items: flex-end; gap: 6px; }
      .ta {
        flex: 1; min-width: 0; resize: none; border: 0; outline: 0; background: transparent;
        font-family: var(--body); font-size: 15px; color: var(--text);
        line-height: 1.5; max-height: 180px; padding: 8px 4px;
      }
      .ta::placeholder { color: var(--text-mute); }
      .icon-btn {
        display: grid; place-items: center; width: 36px; height: 36px; flex: none;
        border-radius: 100px; border: 0; background: transparent; color: var(--text-mute); cursor: pointer;
        transition: color 0.2s var(--ease), background 0.2s var(--ease);
      }
      .icon-btn:hover:not(:disabled) { color: var(--text); background: var(--paper-2); }
      .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .icon-btn.rec { color: var(--coral-deep); background: color-mix(in oklch, var(--coral) 16%, transparent); animation: pulseRec 1.3s var(--ease) infinite; }
      @keyframes pulseRec { 50% { box-shadow: 0 0 0 5px color-mix(in oklch, var(--coral) 18%, transparent); } }
      .send {
        display: grid; place-items: center; width: 38px; height: 38px; flex: none;
        border-radius: 100px; border: 0; background: var(--green); color: var(--ink); cursor: pointer;
        transition: transform 0.25s var(--ease-spring), opacity 0.2s var(--ease);
      }
      .send:hover:not(:disabled) { transform: translateY(-1px); }
      .send:disabled { opacity: 0.4; cursor: not-allowed; }
      @media (prefers-reduced-motion: reduce) { .icon-btn.rec { animation: none; } }
    `,
  ],
})
export class ComposerComponent {
  @Input() placeholder = 'Message Asta…';
  @Input() disabled = false;
  @Output() submit = new EventEmitter<ComposerSubmit>();

  @ViewChild('ta') taRef?: ElementRef<HTMLTextAreaElement>;

  readonly draft = signal('');
  readonly files = signal<File[]>([]);
  readonly recording = signal(false);
  readonly dragging = signal(false);

  // Web Speech API (vendor-prefixed in Chromium). Loosely typed for portability.
  readonly micSupported =
    typeof window !== 'undefined' &&
    !!((window as unknown as Record<string, unknown>)['SpeechRecognition'] ||
      (window as unknown as Record<string, unknown>)['webkitSpeechRecognition']);
  private recognition: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  canSend(): boolean {
    return this.draft().trim().length > 0 || this.files().length > 0;
  }

  onInput(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    this.draft.set(el.value);
    this.autosize(el);
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submitNow();
    }
  }

  submitNow(): void {
    if (this.disabled || !this.canSend()) return;
    this.submit.emit({ text: this.draft().trim(), files: this.files() });
    this.draft.set('');
    this.files.set([]);
    if (this.taRef) {
      this.taRef.nativeElement.value = '';
      this.taRef.nativeElement.style.height = 'auto';
    }
  }

  // ---- files ----
  onFiles(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(true);
  }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    if (e.dataTransfer?.files) this.addFiles(Array.from(e.dataTransfer.files));
  }
  private addFiles(list: File[]): void {
    this.files.update((cur) => [...cur, ...list]);
  }
  removeFile(f: File): void {
    this.files.update((cur) => cur.filter((x) => x !== f));
  }

  // ---- mic dictation ----
  toggleMic(): void {
    if (this.recording()) {
      this.recognition?.stop?.();
      return;
    }
    const Ctor =
      (window as unknown as Record<string, any>)['SpeechRecognition'] ||
      (window as unknown as Record<string, any>)['webkitSpeechRecognition'];
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results as ArrayLike<any>)
        .map((r) => r[0].transcript)
        .join(' ');
      const next = (this.draft() ? this.draft() + ' ' : '') + transcript;
      this.draft.set(next);
      if (this.taRef) {
        this.taRef.nativeElement.value = next;
        this.autosize(this.taRef.nativeElement);
      }
    };
    rec.onend = () => this.recording.set(false);
    rec.onerror = () => this.recording.set(false);
    this.recognition = rec;
    this.recording.set(true);
    rec.start();
  }

  private autosize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }
}
