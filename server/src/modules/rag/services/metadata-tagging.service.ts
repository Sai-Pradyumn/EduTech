import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { AgentType } from '../../../common/enums';
import { tokenize } from '../vector/scoring';
import { Chunk } from './chunking.service';

export interface DocumentTags {
  topic: string;
  tags: string[];
}

/**
 * Enriches chunks (top TF keywords) so retrieval can be scoped and citations read well,
 * and infers document-level topic/tags once via the AI provider (mock-safe factory).
 */
@Injectable()
export class MetadataTaggingService {
  constructor(private readonly ai: AiService) {}

  /** Top term-frequency keywords for a chunk (drives the sparse path + citation hints). */
  keywordsFor(text: string, max = 6): string[] {
    const counts = new Map<string, number>();
    for (const t of tokenize(text)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([t]) => t);
  }

  async inferDocumentTags(userId: string, title: string, chunks: Chunk[]): Promise<DocumentTags> {
    const sample = chunks.slice(0, 4).map((c) => c.text).join('\n').slice(0, 1200);

    // Deterministic fallback (also the mock result): most frequent corpus terms.
    const fallback = (): DocumentTags => {
      const all = `${title}\n${sample}`;
      const counts = new Map<string, number>();
      for (const t of tokenize(all)) counts.set(t, (counts.get(t) ?? 0) + 1);
      const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
      return { topic: tags[0] ? this.titleCase(tags[0]) : title, tags };
    };

    try {
      const result = await this.ai.generateStructuredOutput<DocumentTags>(
        [
          { role: 'system', content: 'Extract a one-word topic and up to 5 lowercase tags from the document sample.' },
          { role: 'user', content: `Title: ${title}\n\n${sample}` },
        ],
        {
          type: 'object',
          properties: { topic: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
          required: ['topic', 'tags'],
        },
        { mockFactory: fallback },
      );
      await this.ai.logUsage({ userId, agentType: AgentType.Rag, operation: 'rag.tag' });
      return result?.topic ? result : fallback();
    } catch {
      return fallback();
    }
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
