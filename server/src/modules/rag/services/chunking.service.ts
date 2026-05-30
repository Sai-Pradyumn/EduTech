import { Injectable } from '@nestjs/common';
import { ParsedDocument } from './document-parser.service';

export interface Chunk {
  text: string;
  headingPath?: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
  /** Provenance for paged (PDF) / timestamped (media) sources; absent for text/md. */
  pageStart?: number;
  pageEnd?: number;
  tStart?: number;
  tEnd?: number;
}

const TARGET_TOKENS = 320; // ~ a tight paragraph cluster; small enough for the mock embedder to stay discriminative.
const MAX_TOKENS = 480;
const OVERLAP_TOKENS = 60;
const MIN_TOKENS = 40;

/** Cheap, provider-independent token estimate (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Structure- and token-aware splitting (not naive fixed slicing): heading sections →
 * paragraphs → sentences, never splitting mid-sentence, with overlap so context spans
 * boundaries and small fragments coalesced forward.
 */
@Injectable()
export class ChunkingService {
  chunk(parsed: ParsedDocument): Chunk[] {
    const sections = this.toSections(parsed);
    const chunks: Chunk[] = [];
    for (const section of sections) {
      chunks.push(...this.chunkSection(section.text, section.charBase, section.headingPath));
    }
    return this.coalesce(chunks);
  }

  private toSections(
    parsed: ParsedDocument,
  ): { text: string; charBase: number; headingPath?: string }[] {
    const outline = parsed.outline ?? [];
    if (outline.length === 0) return [{ text: parsed.text, charBase: 0 }];

    const sections: { text: string; charBase: number; headingPath?: string }[] = [];
    const stack: { level: number; title: string }[] = [];

    // Preamble before the first heading.
    if (outline[0].charStart > 0) {
      sections.push({ text: parsed.text.slice(0, outline[0].charStart), charBase: 0 });
    }

    for (let i = 0; i < outline.length; i++) {
      const h = outline[i];
      const end = i + 1 < outline.length ? outline[i + 1].charStart : parsed.text.length;
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      stack.push({ level: h.level, title: h.title });
      const headingPath = stack.map((s) => s.title).join(' ▸ ');
      // Body excludes the heading line itself.
      const lineEnd = parsed.text.indexOf('\n', h.charStart);
      const bodyStart = lineEnd === -1 ? h.charStart : lineEnd + 1;
      sections.push({ text: parsed.text.slice(bodyStart, end), charBase: bodyStart, headingPath });
    }
    return sections;
  }

  private chunkSection(text: string, charBase: number, headingPath?: string): Chunk[] {
    const blocks = this.splitBlocks(text);
    const chunks: Chunk[] = [];
    let buf = '';
    let bufStart = -1;
    let cursor = 0;

    const flush = (endOffset: number): void => {
      const trimmed = buf.trim();
      if (trimmed) {
        chunks.push({
          text: trimmed,
          headingPath,
          charStart: charBase + bufStart,
          charEnd: charBase + endOffset,
          tokenCount: estimateTokens(trimmed),
        });
      }
      buf = '';
      bufStart = -1;
    };

    for (const block of blocks) {
      const blockTokens = estimateTokens(block.text);
      if (blockTokens > MAX_TOKENS) {
        if (buf) flush(cursor);
        for (const sent of this.splitSentences(block.text, block.offset)) {
          if (estimateTokens(buf + sent.text) > TARGET_TOKENS && buf) flush(cursor);
          if (!buf) bufStart = sent.offset - charBase;
          buf += (buf ? ' ' : '') + sent.text;
          cursor = sent.offset - charBase + sent.text.length;
        }
        continue;
      }
      if (estimateTokens(buf + block.text) > TARGET_TOKENS && buf) flush(cursor);
      if (!buf) bufStart = block.offset - charBase;
      buf += (buf ? '\n\n' : '') + block.text;
      cursor = block.offset - charBase + block.text.length;
    }
    if (buf) flush(cursor);

    return this.addOverlap(chunks);
  }

  /** Paragraph blocks with their char offset within the section text. */
  private splitBlocks(text: string): { text: string; offset: number }[] {
    const blocks: { text: string; offset: number }[] = [];
    const re = /\n\s*\n/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const seg = text.slice(last, m.index);
      if (seg.trim()) blocks.push({ text: seg.trim(), offset: last });
      last = re.lastIndex;
    }
    const tail = text.slice(last);
    if (tail.trim()) blocks.push({ text: tail.trim(), offset: last });
    return blocks;
  }

  private splitSentences(text: string, base: number): { text: string; offset: number }[] {
    const out: { text: string; offset: number }[] = [];
    const re = /[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].trim();
      if (s) out.push({ text: s, offset: base + m.index });
    }
    return out.length ? out : [{ text: text.trim(), offset: base }];
  }

  /** Prepend a token-bounded tail of the previous chunk so context spans boundaries. */
  private addOverlap(chunks: Chunk[]): Chunk[] {
    if (chunks.length < 2) return chunks;
    const overlapChars = OVERLAP_TOKENS * 4;
    return chunks.map((c, i) => {
      if (i === 0) return c;
      const prev = chunks[i - 1].text;
      const tail = prev.slice(Math.max(0, prev.length - overlapChars));
      const text = `${tail} … ${c.text}`;
      return { ...c, text, tokenCount: estimateTokens(text) };
    });
  }

  /** Merge sub-MIN fragments forward to avoid useless tiny chunks. */
  private coalesce(chunks: Chunk[]): Chunk[] {
    const out: Chunk[] = [];
    for (const c of chunks) {
      const prev = out[out.length - 1];
      if (prev && c.tokenCount < MIN_TOKENS && prev.headingPath === c.headingPath) {
        prev.text = `${prev.text}\n\n${c.text}`;
        prev.charEnd = c.charEnd;
        prev.tokenCount = estimateTokens(prev.text);
      } else {
        out.push({ ...c });
      }
    }
    return out;
  }
}
