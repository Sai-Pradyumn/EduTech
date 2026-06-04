import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

const KEYWORDS: Record<string, readonly string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'super', 'this', 'typeof', 'instanceof', 'in', 'of', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'import', 'export', 'default', 'from', 'void', 'delete', 'null', 'undefined', 'true', 'false', 'NaN'],
  python: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'yield', 'global', 'nonlocal', 'pass', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'self', 'print', 'len', 'range'],
  sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'LIKE', 'IN', 'BETWEEN'],
  java: ['public', 'private', 'protected', 'static', 'final', 'class', 'interface', 'extends', 'implements', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'String', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'null', 'true', 'false'],
  cpp: ['int', 'long', 'double', 'float', 'char', 'bool', 'void', 'auto', 'const', 'static', 'struct', 'class', 'public', 'private', 'protected', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'delete', 'this', 'try', 'catch', 'throw', 'namespace', 'using', 'include', 'true', 'false', 'nullptr', 'std'],
  go: ['func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'defer', 'go', 'select', 'nil', 'true', 'false'],
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN = /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

/**
 * A custom, dependency-free code editor: a syntax-highlighted underlay with a
 * transparent textarea on top (scroll-synced), a line-number gutter, smart Tab/
 * indent and bracket pairing. Noir-themed; works offline. Highlighting is a small
 * tokenizer covering JS/Python/SQL/Java/C++/Go — enough to feel like a real IDE.
 */
@Component({
  selector: 'asta-code-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div #gutter class="gutter"><div class="g-inner">@for (n of lineNumbers(); track n) {<span>{{ n }}</span>}</div></div>
      <div class="code">
        <pre #hl class="hl" aria-hidden="true"><code [innerHTML]="highlighted()"></code></pre>
        <textarea
          #ta
          class="ta"
          wrap="off"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          (input)="onInput($event)"
          (scroll)="onScroll()"
          (keydown)="onKey($event)"
          [attr.aria-label]="ariaLabel()"
        ></textarea>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .wrap { display: flex; position: relative; min-height: 320px; border-radius: 14px; overflow: hidden; background: var(--asta-bg-soft); border: 1px solid var(--asta-border); font-family: var(--mono); font-size: 13.5px; line-height: 1.55; }
      .wrap:focus-within { border-color: color-mix(in srgb, var(--asta-green) 50%, transparent); }

      .gutter { width: 46px; flex-shrink: 0; overflow: hidden; background: color-mix(in srgb, var(--asta-bg) 60%, transparent); border-right: 1px solid var(--asta-border); }
      .g-inner { padding: 12px 0; display: flex; flex-direction: column; align-items: flex-end; will-change: transform; }
      .g-inner span { padding: 0 10px 0 0; color: var(--asta-subtle); font-size: 12px; line-height: 1.55; height: 1.55em; }

      .code { position: relative; flex: 1; min-width: 0; }
      .hl, .ta { margin: 0; padding: 12px 14px; font-family: inherit; font-size: inherit; line-height: inherit; tab-size: 2; white-space: pre; overflow: hidden; border: 0; }
      .hl { position: absolute; inset: 0; pointer-events: none; color: var(--asta-text); overflow: hidden; }
      .hl code { font: inherit; }
      .ta { position: absolute; inset: 0; width: 100%; height: 100%; resize: none; background: transparent; color: transparent; caret-color: var(--asta-green); outline: none; overflow: auto; }
      .ta::selection { background: color-mix(in srgb, var(--asta-green) 30%, transparent); }

      .tok-com { color: var(--asta-subtle); font-style: italic; }
      .tok-str { color: var(--asta-gold); }
      .tok-num { color: var(--asta-coral); }
      .tok-kw { color: var(--asta-violet); font-weight: 600; }
      .tok-fn { color: var(--asta-cyan); }
    `,
  ],
})
export class AstaCodeEditorComponent {
  readonly value = input<string>('');
  readonly language = input<string>('javascript');
  readonly ariaLabel = input('Code editor');
  readonly valueChange = output<string>();

  private readonly ta = viewChild<ElementRef<HTMLTextAreaElement>>('ta');
  private readonly hl = viewChild<ElementRef<HTMLPreElement>>('hl');
  private readonly gutter = viewChild<ElementRef<HTMLDivElement>>('gutter');

  protected readonly lineNumbers = computed(() => {
    const count = Math.max(1, this.value().split('\n').length);
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  protected readonly highlighted = computed(() => this.highlight(this.value(), this.language()));

  constructor() {
    // Sync the textarea only when `value` changes from OUTSIDE (reset, template
    // switch). During typing the values already match, so we never rewrite the
    // textarea — which would otherwise jump the caret to the end on every key.
    effect(() => {
      const v = this.value();
      const el = this.ta()?.nativeElement;
      if (el && el.value !== v) {
        el.value = v;
        queueMicrotask(() => this.onScroll());
      }
    });
  }

  protected onInput(e: Event): void {
    this.valueChange.emit((e.target as HTMLTextAreaElement).value);
    queueMicrotask(() => this.onScroll());
  }

  protected onScroll(): void {
    const ta = this.ta()?.nativeElement;
    const hl = this.hl()?.nativeElement;
    const g = this.gutter()?.nativeElement;
    if (!ta) return;
    if (hl) {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
    }
    if (g) g.scrollTop = ta.scrollTop;
  }

  protected onKey(e: KeyboardEvent): void {
    const ta = this.ta()?.nativeElement;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: end, value } = ta;

    if (e.key === 'Tab') {
      e.preventDefault();
      this.replace(ta, s, end, '  ', s + 2);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const indent = /^[ \t]*/.exec(value.slice(lineStart, s))?.[0] ?? '';
      const prevChar = value[s - 1];
      const extra = prevChar === '{' || prevChar === '[' || prevChar === '(' || prevChar === ':' ? '  ' : '';
      this.replace(ta, s, end, `\n${indent}${extra}`, s + 1 + indent.length + extra.length);
    } else if (['(', '[', '{'].includes(e.key) && s === end) {
      e.preventDefault();
      const close = e.key === '(' ? ')' : e.key === '[' ? ']' : '}';
      this.replace(ta, s, end, e.key + close, s + 1);
    }
  }

  private replace(ta: HTMLTextAreaElement, from: number, to: number, text: string, caret: number): void {
    const next = ta.value.slice(0, from) + text + ta.value.slice(to);
    ta.value = next;
    ta.selectionStart = ta.selectionEnd = caret;
    this.valueChange.emit(next);
    queueMicrotask(() => this.onScroll());
  }

  private highlight(code: string, language: string): string {
    const keywords = new Set(KEYWORDS[language] ?? KEYWORDS['javascript']);
    let out = '';
    let last = 0;
    let m: RegExpExecArray | null;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code)) !== null) {
      out += escapeHtml(code.slice(last, m.index));
      const [full, comment, str, num, word] = m;
      if (comment) out += `<span class="tok-com">${escapeHtml(comment)}</span>`;
      else if (str) out += `<span class="tok-str">${escapeHtml(str)}</span>`;
      else if (num) out += `<span class="tok-num">${num}</span>`;
      else if (word) {
        const isKw = keywords.has(word);
        const isFn = !isKw && code[TOKEN.lastIndex] === '(';
        const cls = isKw ? 'tok-kw' : isFn ? 'tok-fn' : '';
        out += cls ? `<span class="${cls}">${escapeHtml(word)}</span>` : escapeHtml(word);
      }
      last = m.index + full.length;
    }
    out += escapeHtml(code.slice(last));
    return `${out}\n`;
  }
}
