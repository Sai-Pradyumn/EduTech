import { Injectable } from '@nestjs/common';
import { ChunkHit } from '../vector/vector-store.interface';

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  locator: string;
  snippet: string;
  score: number;
}

/** Turns retrieved hits into numbered citations with human-readable locators. */
@Injectable()
export class CitationService {
  build(hits: ChunkHit[]): Citation[] {
    return hits.map((h, i) => ({
      n: i + 1,
      chunkId: h.chunkId,
      documentId: h.documentId,
      documentTitle: h.documentTitle,
      locator: this.locator(h),
      snippet: this.snippet(h.text),
      score: Math.round(h.score * 100) / 100,
    }));
  }

  private locator(h: ChunkHit): string {
    if (h.pageStart != null) {
      return h.pageEnd && h.pageEnd !== h.pageStart ? `p.${h.pageStart}–${h.pageEnd}` : `p.${h.pageStart}`;
    }
    if (h.tStart != null) return this.timecode(h.tStart);
    if (h.headingPath) return h.headingPath;
    return h.documentTitle;
  }

  private timecode(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private snippet(text: string, max = 240): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  }
}
