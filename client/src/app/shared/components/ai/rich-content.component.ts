import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import { renderMermaid } from '../../util/mermaid';
import { ToastService } from '../../../core/services/toast.service';

/** Languages we can execute in the code lab (matches the Piston-backed practice runner). */
const RUNNABLE = new Set([
  'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java',
  'c', 'cpp', 'c++', 'go', 'rust', 'rs', 'ruby', 'php', 'bash', 'sh', 'csharp',
]);

export interface RunCodeRequest {
  language: string;
  code: string;
}

/**
 * Rich assistant-message renderer: markdown → HTML with syntax-highlighted code (+ Copy and
 * Run-in-Lab buttons), inline mermaid diagrams rendered for real, and KaTeX math. While a reply
 * is still streaming it renders plain markdown only; the heavy passes run once it settles, so
 * token-by-token streaming stays smooth.
 */
@Component({
  selector: 'asta-rich-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Styles for the injected innerHTML live in global styles.css (`.rich …`) because emulated
  // view encapsulation doesn't reach dynamically-inserted nodes.
  template: `<div #host class="prose-asta rich"></div>`,
  styles: [`:host { display: block; }`],
})
export class RichContentComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly toast = inject(ToastService);
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  @Input() text = '';
  @Input() streaming = false;
  @Output() runCode = new EventEmitter<RunCodeRequest>();

  private clickHandler = (ev: Event) => this.onClick(ev);
  private renderedFull = false;

  ngAfterViewInit(): void {
    this.host.nativeElement.addEventListener('click', this.clickHandler);
    this.render();
  }

  ngOnChanges(): void {
    if (this.host) this.render();
  }

  ngOnDestroy(): void {
    this.host?.nativeElement.removeEventListener('click', this.clickHandler);
  }

  private render(): void {
    const el = this.host.nativeElement;
    el.innerHTML = marked.parse(this.text ?? '', { async: false }) as string;
    // While streaming, keep it cheap — full enhancement runs once the reply settles.
    if (this.streaming) {
      this.renderedFull = false;
      return;
    }
    if (this.renderedFull) return;
    this.renderedFull = true;
    this.enhanceCodeBlocks(el);
    void this.renderMermaidBlocks(el);
    void this.renderMath(el);
  }

  /** Highlight code blocks and wrap each in a toolbar (language + Copy + Run in Lab). */
  private enhanceCodeBlocks(root: HTMLElement): void {
    const pres = Array.from(root.querySelectorAll('pre'));
    for (const pre of pres) {
      const code = pre.querySelector('code');
      if (!code) continue;
      const langClass = Array.from(code.classList).find((c) => c.startsWith('language-'));
      const lang = (langClass?.slice('language-'.length) ?? '').toLowerCase();
      if (lang === 'mermaid') continue; // handled separately
      const raw = code.textContent ?? '';
      try {
        if (lang && hljs.getLanguage(lang)) {
          code.innerHTML = hljs.highlight(raw, { language: lang }).value;
        } else {
          code.innerHTML = hljs.highlightAuto(raw).value;
        }
        code.classList.add('hljs');
      } catch {
        /* leave as-is */
      }
      const wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      const bar = document.createElement('div');
      bar.className = 'code-bar';
      const runBtn = RUNNABLE.has(lang)
        ? `<button class="code-btn" data-run="1" type="button">Run in Lab</button>`
        : '';
      bar.innerHTML =
        `<span class="code-lang">${lang || 'code'}</span>` +
        `<span class="code-actions">${runBtn}<button class="code-btn" data-copy="1" type="button">Copy</button></span>`;
      pre.parentNode?.insertBefore(wrap, pre);
      wrap.appendChild(bar);
      wrap.appendChild(pre);
      // Stash raw source + language for the click handler.
      wrap.setAttribute('data-lang', lang);
      (wrap as HTMLElement & { _raw?: string })._raw = raw;
    }
  }

  private async renderMermaidBlocks(root: HTMLElement): Promise<void> {
    const blocks = Array.from(root.querySelectorAll('code.language-mermaid'));
    for (const code of blocks) {
      const pre = code.closest('pre') ?? code;
      try {
        const svg = await renderMermaid(code.textContent ?? '');
        const div = document.createElement('div');
        div.className = 'mermaid-rendered';
        div.innerHTML = svg;
        pre.replaceWith(div);
      } catch {
        /* leave the source visible on failure */
      }
    }
  }

  private async renderMath(root: HTMLElement): Promise<void> {
    if (!/\$.+\$/.test(root.textContent ?? '')) return;
    try {
      const renderMathInElement = (await import('katex/contrib/auto-render')).default;
      renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    } catch {
      /* katex unavailable — leave raw */
    }
  }

  private onClick(ev: Event): void {
    const target = ev.target as HTMLElement;
    const btn = target.closest('button');
    if (!btn) return;
    const wrap = btn.closest('.code-wrap') as (HTMLElement & { _raw?: string }) | null;
    const raw = wrap?._raw ?? '';
    if (btn.hasAttribute('data-copy')) {
      void navigator.clipboard?.writeText(raw).then(() => this.toast.success('Copied'));
    } else if (btn.hasAttribute('data-run')) {
      this.runCode.emit({ language: wrap?.getAttribute('data-lang') ?? '', code: raw });
    }
  }
}
