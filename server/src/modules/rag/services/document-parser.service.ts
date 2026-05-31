import { Injectable, Logger } from '@nestjs/common';

export interface PageSpan {
  page: number;
  text: string;
}

export interface Heading {
  level: number;
  title: string;
  charStart: number;
}

export interface ParsedDocument {
  text: string;
  pages?: PageSpan[];
  outline?: Heading[];
  /** Per-cue transcript for media sources (seconds + text). */
  cues?: { tStart: number; tEnd: number; text: string }[];
  language: string;
  warnings: string[];
}

export interface ParseInput {
  buffer?: Buffer;
  rawText?: string;
  mimeType: string;
  filename?: string;
}

/**
 * Dispatches on MIME / extension to a per-format parser returning normalized text +
 * provenance. Parsers never throw on partial content — unreadable regions are skipped
 * and recorded in `warnings`. TXT / MD / JSON / pasted text are parsed natively (no deps);
 * PDF / DOCX are lazy-loaded and degrade to a clear warning when the optional parser
 * package (`pdf-parse` / `mammoth`) is not installed in this build.
 */
/**
 * Runtime-only dynamic import that bypasses the compiler's module resolution, so optional
 * parser packages (`pdf-parse` / `mammoth`) don't need to be installed for the build.
 */
const optionalImport = (specifier: string): Promise<unknown> => {
  // Intentional runtime dynamic import the compiler won't rewrite, so optional parser
  // packages (`pdf-parse` / `mammoth`) stay optional and need not be installed.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynamicImport = Function('s', 'return import(s)') as (
    s: string,
  ) => Promise<unknown>;
  return dynamicImport(specifier);
};

@Injectable()
export class DocumentParserService {
  private readonly log = new Logger(DocumentParserService.name);

  async parse(input: ParseInput): Promise<ParsedDocument> {
    const mime = (input.mimeType || '').toLowerCase();
    const name = (input.filename || '').toLowerCase();

    if (input.rawText !== undefined)
      return this.fromMarkdownOrText(input.rawText, name);

    const buf = input.buffer ?? Buffer.alloc(0);

    if (mime.includes('pdf') || name.endsWith('.pdf')) return this.fromPdf(buf);
    if (mime.includes('wordprocessingml') || name.endsWith('.docx'))
      return this.fromDocx(buf);
    if (mime.includes('json') || name.endsWith('.json'))
      return this.fromJson(buf);
    // text/plain, text/markdown, .md, .txt, and unknown text-like uploads.
    return this.fromMarkdownOrText(buf.toString('utf8'), name);
  }

  private fromMarkdownOrText(raw: string, name: string): ParsedDocument {
    const text = raw.replace(/\r\n/g, '\n').trim();
    const isMd = name.endsWith('.md') || /^#{1,6}\s/m.test(text);
    const outline: Heading[] = [];
    if (isMd) {
      const re = /^(#{1,6})\s+(.+)$/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        outline.push({
          level: m[1].length,
          title: m[2].trim(),
          charStart: m.index,
        });
      }
    }
    return {
      text,
      outline: outline.length ? outline : undefined,
      language: 'en',
      warnings: [],
    };
  }

  private fromJson(buf: Buffer): ParsedDocument {
    const warnings: string[] = [];
    let text = '';
    try {
      const obj: unknown = JSON.parse(buf.toString('utf8'));
      text = this.flattenJson(obj).join('\n');
    } catch {
      warnings.push('Invalid JSON — indexed as raw text.');
      text = buf.toString('utf8');
    }
    return { text: text.trim(), language: 'en', warnings };
  }

  private flattenJson(node: unknown, prefix = ''): string[] {
    if (node === null || node === undefined) return [];
    if (typeof node !== 'object')
      return [`${prefix}${node as string | number | boolean}`];
    if (Array.isArray(node))
      return node.flatMap((v) => this.flattenJson(v, prefix));
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
      this.flattenJson(v, prefix ? `${prefix}.${k}: ` : `${k}: `),
    );
  }

  private async fromPdf(buf: Buffer): Promise<ParsedDocument> {
    try {
      // Lazy + optional: avoids a hard dependency when PDF support isn't installed.
      const mod = (await optionalImport('pdf-parse').catch(() => null)) as {
        default?: (b: Buffer) => Promise<{ text: string; numpages: number }>;
      } | null;
      const pdfParse =
        mod?.default ??
        (mod as unknown as (
          b: Buffer,
        ) => Promise<{ text: string; numpages: number }>);
      if (!pdfParse) throw new Error('pdf-parse not installed');
      const result = await pdfParse(buf);
      return { text: (result.text || '').trim(), language: 'en', warnings: [] };
    } catch (err) {
      this.log.warn(`PDF parsing unavailable: ${(err as Error).message}`);
      return {
        text: '',
        language: 'en',
        warnings: [
          'PDF text extraction is not available in this build (install `pdf-parse`). ' +
            'Paste the text or upload a .txt/.md instead.',
        ],
      };
    }
  }

  private async fromDocx(buf: Buffer): Promise<ParsedDocument> {
    try {
      const mod = (await optionalImport('mammoth').catch(() => null)) as {
        extractRawText?: (o: { buffer: Buffer }) => Promise<{ value: string }>;
      } | null;
      if (!mod?.extractRawText) throw new Error('mammoth not installed');
      const result = await mod.extractRawText({ buffer: buf });
      return {
        text: (result.value || '').trim(),
        language: 'en',
        warnings: [],
      };
    } catch (err) {
      this.log.warn(`DOCX parsing unavailable: ${(err as Error).message}`);
      return {
        text: '',
        language: 'en',
        warnings: [
          'DOCX text extraction is not available in this build (install `mammoth`). ' +
            'Paste the text or upload a .txt/.md instead.',
        ],
      };
    }
  }
}
