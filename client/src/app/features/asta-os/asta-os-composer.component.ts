import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { QUICK_CHIPS } from './asta-os.constants';

interface SlashCommand {
  name: string;
  label: string;
  hint: string;
  /** Build the prompt to send from any text typed after the command. */
  build: (arg: string) => string;
}

/** Slash commands — type "/" in the composer to summon them. */
const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'explain', label: '/explain', hint: 'Explain a topic clearly', build: (a) => a ? `Explain ${a}` : 'Explain what we just covered, clearly.' },
  { name: 'simpler', label: '/simpler', hint: 'Re-explain more simply', build: (a) => a ? `Explain ${a} in the simplest way possible.` : 'Explain your last answer again, but much simpler.' },
  { name: 'quiz', label: '/quiz', hint: 'Generate a quick quiz', build: (a) => `Make a short quiz on ${a || 'what we just covered'}.` },
  { name: 'flashcards', label: '/flashcards', hint: 'Make flashcards', build: (a) => `Turn ${a || 'this topic'} into flashcards.` },
  { name: 'visualize', label: '/visualize', hint: 'Draw a diagram', build: (a) => `Show ${a || 'this'} as a diagram.` },
  { name: 'example', label: '/example', hint: 'Give worked examples', build: (a) => `Give me a few concrete worked examples of ${a || 'this'}.` },
  { name: 'practice', label: '/practice', hint: 'Get a coding problem', build: (a) => `Give me a hands-on practice problem about ${a || 'this topic'}.` },
  { name: 'interview', label: '/interview', hint: 'Mock interview', build: (a) => `Run a mock interview to prepare me${a ? ` for ${a}` : ''}.` },
  { name: 'roadmap', label: '/roadmap', hint: 'Plan next steps', build: (a) => a ? `Add ${a} to my roadmap and plan the next steps.` : 'Continue my roadmap — what should I do next?' },
];

/**
 * Universal Asta OS input. Mode-aware placeholder, mic trigger, quick-chip
 * suggestions, slash commands ("/"), ↑ to recall the last prompt, Enter-to-send /
 * Shift+Enter newline. Emits the trimmed message on `send` and a `mic` request.
 * Noir-styled; self-contained textarea (no heavy editor dependency).
 */
@Component({
  selector: 'asta-os-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" [class.disabled]="disabled()">
      @if (slashItems().length) {
        <div class="slash" role="listbox" aria-label="Slash commands">
          @for (c of slashItems(); track c.name; let i = $index) {
            <button type="button" role="option" [attr.aria-selected]="i === 0" class="slash-item" [class.on]="i === 0" (click)="applyCommand(c)">
              <span class="s-name">{{ c.label }}</span><span class="s-hint">{{ c.hint }}</span>
            </button>
          }
        </div>
      }
      <div class="chips" role="list">
        @for (c of chips; track c.label) {
          <button type="button" role="listitem" class="chip" [disabled]="disabled()" (click)="send.emit(c.prompt)">{{ c.label }}</button>
        }
      </div>

      @if (attached().length) {
        <div class="files" role="list">
          @for (f of attached(); track f.name + f.size) {
            <span class="file" role="listitem">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              {{ f.name }}
              <button type="button" class="file-x" (click)="removeFile(f)" aria-label="Remove attachment">×</button>
            </span>
          }
        </div>
      }

      <div class="bar" (dragover)="onDragOver($event)" (drop)="onDrop($event)">
        <input #fileIn type="file" multiple hidden (change)="onFiles($event)" />
        <button type="button" class="icon-btn clip" [disabled]="disabled()" (click)="fileIn.click()" aria-label="Attach files" title="Attach files to ground the answer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        </button>
        <textarea
          #ta
          class="field"
          rows="1"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [value]="draft()"
          (input)="onInput($event)"
          (keydown)="onKey($event)"
          aria-label="Message Asta"
        ></textarea>

        @if (micSupported()) {
          <button
            type="button"
            class="icon-btn mic"
            [class.live]="listening()"
            (click)="mic.emit()"
            [attr.aria-pressed]="listening()"
            aria-label="Talk to Asta"
            title="Talk to Asta"
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        }

        <button type="button" class="icon-btn go" [disabled]="disabled() || (!draft().trim() && !attached().length)" (click)="submit()" aria-label="Send to Asta">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap { display: flex; flex-direction: column; gap: 12px; }
      .wrap.disabled { opacity: .7; }
      .slash { display: flex; flex-direction: column; gap: 2px; padding: 6px; border-radius: 14px; border: 1px solid var(--asta-border); background: var(--asta-panel-strong); backdrop-filter: blur(14px); box-shadow: 0 18px 50px rgba(0,0,0,.35); max-height: 240px; overflow: auto; }
      .slash-item { display: flex; align-items: baseline; gap: 10px; padding: 7px 10px; border-radius: 9px; text-align: left; }
      .slash-item:hover, .slash-item.on { background: var(--asta-panel); }
      .s-name { font-family: var(--mono); font-size: 12.5px; color: var(--asta-green); min-width: 96px; }
      .s-hint { font-size: 12.5px; color: var(--asta-muted); }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip {
        font-size: 12.5px; padding: 6px 13px; border-radius: 999px;
        border: 1px solid var(--asta-border); background: var(--asta-panel); color: var(--asta-muted);
        transition: transform .16s ease, border-color .16s ease, color .16s ease;
      }
      .chip:hover:not(:disabled) { transform: translateY(-2px); color: var(--asta-text); border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); }
      .chip:disabled { cursor: default; }

      .bar {
        display: flex; align-items: flex-end; gap: 8px;
        padding: 8px 8px 8px 16px; border-radius: 18px;
        background: var(--asta-panel-strong); border: 1px solid var(--asta-border); backdrop-filter: blur(14px);
        box-shadow: 0 0 0 1px transparent, 0 18px 50px rgba(0,0,0,.35);
        transition: border-color .2s ease, box-shadow .2s ease;
      }
      .bar:focus-within { border-color: color-mix(in srgb, var(--asta-green) 55%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--asta-green) 35%, transparent), 0 18px 50px rgba(0,0,0,.4); }

      .field {
        flex: 1; resize: none; border: 0; outline: 0; background: transparent;
        color: var(--asta-text); font-size: 15px; line-height: 1.5; max-height: 180px;
        padding: 7px 0; font-family: inherit;
      }
      .field::placeholder { color: var(--asta-subtle); }

      .files { display: flex; flex-wrap: wrap; gap: 6px; }
      .file { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 6px 4px 10px; border-radius: 999px; border: 1px solid var(--asta-border); background: var(--asta-panel); color: var(--asta-muted); }
      .file-x { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; color: var(--asta-subtle); font-size: 15px; line-height: 1; }
      .file-x:hover { color: var(--asta-coral); }
      .clip { width: 38px; height: 38px; }
      .icon-btn { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: var(--asta-muted); flex-shrink: 0; transition: color .16s ease, background .16s ease, transform .14s ease; }
      .icon-btn:hover:not(:disabled) { color: var(--asta-text); background: var(--asta-panel); }
      .mic.live { color: #06100a; background: var(--asta-green); box-shadow: 0 0 16px color-mix(in srgb, var(--asta-green) 55%, transparent); }
      .go { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); }
      .go:disabled { opacity: .4; cursor: default; background: var(--asta-panel); color: var(--asta-subtle); }

      /* Slash menu surfaces like a thought; items cascade. */
      .slash { animation: astaRevealUp .25s var(--ease) both; }
      .slash-item { animation: astaRevealUp .25s var(--ease) both; }
      .slash-item:nth-child(2) { animation-delay: .03s; }
      .slash-item:nth-child(3) { animation-delay: .06s; }
      .slash-item:nth-child(4) { animation-delay: .09s; }
      .slash-item:nth-child(5) { animation-delay: .12s; }
      /* Quick chips drift in once on load. */
      .chip { animation: astaRevealUp .4s var(--ease) both; }
      .chip:nth-child(2) { animation-delay: .05s; }
      .chip:nth-child(3) { animation-delay: .1s; }
      .chip:nth-child(4) { animation-delay: .15s; }
      .chip:nth-child(5) { animation-delay: .2s; }
      .chip:nth-child(6) { animation-delay: .25s; }
      .file { animation: astaSoftPop .3s var(--ease-spring) both; }
      /* The live mic breathes while listening. */
      .mic.live { animation: astaOsMicBreathe 1.6s ease-in-out infinite; }
      @keyframes astaOsMicBreathe {
        0%, 100% { box-shadow: 0 0 16px color-mix(in srgb, var(--asta-green) 55%, transparent); }
        50% { box-shadow: 0 0 28px color-mix(in srgb, var(--asta-green) 80%, transparent); }
      }
      .go:not(:disabled):hover { transform: scale(1.06); }
      @media (prefers-reduced-motion: reduce) { .slash, .slash-item, .chip, .file, .mic.live { animation: none; } .go:not(:disabled):hover { transform: none; } }
    `,
  ],
})
export class AstaOsComposerComponent {
  readonly placeholder = input('Ask Asta anything…');
  readonly disabled = input(false);
  readonly micSupported = input(false);
  readonly listening = input(false);
  /** Text pushed into the draft (edit & resend). The nonce forces a re-fill on repeat edits. */
  readonly seed = input<{ text: string; nonce: number } | null>(null);
  /** Incrementing nonce that requests focus (Cmd/Ctrl-K). */
  readonly focusNonce = input(0);

  constructor() {
    effect(() => {
      const s = this.seed();
      if (s) this.setDraft(s.text);
    });
    effect(() => {
      if (this.focusNonce() > 0) this.ta()?.nativeElement.focus();
    });
  }

  readonly send = output<string>();
  readonly mic = output<void>();
  /** Files attached to ground the next message (emitted just before `send`). */
  readonly attach = output<File[]>();

  protected readonly attached = signal<File[]>([]);

  protected readonly chips = QUICK_CHIPS;
  protected readonly draft = signal('');
  private lastSent = '';
  private readonly ta = viewChild<ElementRef<HTMLTextAreaElement>>('ta');

  /** Slash-command suggestions: shown while typing the command token (e.g. "/qu"). */
  protected readonly slashItems = computed<SlashCommand[]>(() => {
    const d = this.draft();
    const m = /^\/(\w*)$/.exec(d.trimStart());
    if (!m) return [];
    const q = m[1].toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.name.startsWith(q));
  });

  protected onInput(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    this.draft.set(el.value);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  protected onKey(e: KeyboardEvent): void {
    // ↑ on an empty field recalls the last prompt sent.
    if (e.key === 'ArrowUp' && !this.draft() && this.lastSent) {
      e.preventDefault();
      this.setDraft(this.lastSent);
      return;
    }
    const items = this.slashItems();
    if (e.key === 'Escape' && items.length) {
      e.preventDefault();
      this.setDraft('');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (items.length) {
        this.applyCommand(items[0]);
      } else {
        this.submit();
      }
    }
  }

  protected applyCommand(cmd: SlashCommand): void {
    // Anything typed after the command name becomes the command's argument.
    const arg = this.draft().trimStart().replace(/^\/\w*\s*/, '').trim();
    this.emit(cmd.build(arg));
  }

  protected submit(): void {
    const text = this.draft().trim();
    if (!text) {
      // Files with no text → ask Asta to work from the attachments.
      if (this.attached().length) this.emit('Summarize the attached document(s) and pull out the key points.');
      return;
    }
    // Resolve a fully-typed slash command ("/quiz react") even without picking from the menu.
    const m = /^\/(\w+)(?:\s+([\s\S]*))?$/.exec(text);
    const cmd = m && SLASH_COMMANDS.find((c) => c.name === m[1].toLowerCase());
    this.emit(cmd ? cmd.build((m![2] ?? '').trim()) : text);
  }

  // ── attachments ──
  protected onFiles(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.addFiles(input.files);
    input.value = '';
  }
  protected onDragOver(e: DragEvent): void {
    e.preventDefault();
  }
  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.addFiles(e.dataTransfer?.files ?? null);
  }
  private addFiles(list: FileList | null): void {
    if (!list?.length) return;
    this.attached.update((cur) => [...cur, ...Array.from(list)].slice(0, 5));
  }
  protected removeFile(f: File): void {
    this.attached.update((cur) => cur.filter((x) => x !== f));
  }

  private emit(prompt: string): void {
    const text = prompt.trim();
    if (!text || this.disabled()) return;
    // Hand attachments to the shell first so they're grounded into this send.
    if (this.attached().length) {
      this.attach.emit(this.attached());
      this.attached.set([]);
    }
    this.lastSent = text;
    this.send.emit(text);
    this.setDraft('');
  }

  private setDraft(value: string): void {
    this.draft.set(value);
    const el = this.ta()?.nativeElement;
    if (el) {
      el.value = value;
      el.style.height = 'auto';
      if (value) el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
      el.focus();
    }
  }
}
