import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ChunkHit } from './vector-store.interface';

/**
 * Reorders fused hits before truncation to top-k. A cross-encoder / LLM-rerank
 * implementation drops in here without touching callers.
 */
export interface IReranker {
  rerank(query: string, hits: ChunkHit[]): Promise<ChunkHit[]>;
}

/** Default — passes hits through unchanged (used when no LLM key is configured). */
@Injectable()
export class NoopReranker implements IReranker {
  rerank(_query: string, hits: ChunkHit[]): Promise<ChunkHit[]> {
    return Promise.resolve(hits);
  }
}

const RERANK_SCHEMA = {
  type: 'object',
  properties: {
    order: {
      type: 'array',
      items: { type: 'number' },
      description: 'candidate indices, most relevant first',
    },
  },
  required: ['order'],
} as const;

/**
 * LLM reranker — when a live model is configured, asks it to order the top candidates by
 * relevance to the question (a cheap, deterministic structured call). Falls back to the
 * original order on no-key/failure. Reordering is for relevance/citation order only; the
 * refusal gate uses the max score (see RagAnswerService) so grounding stays honest.
 */
@Injectable()
export class LlmReranker implements IReranker {
  constructor(private readonly ai: AiService) {}

  async rerank(query: string, hits: ChunkHit[]): Promise<ChunkHit[]> {
    if (!this.ai.isLive || hits.length < 3) return hits;
    const pool = hits.slice(0, 8);
    try {
      const list = pool
        .map(
          (h, i) =>
            `[${i}] ${h.text.replace(/\s+/g, ' ').trim().slice(0, 240)}`,
        )
        .join('\n');
      const res = await this.ai.generateStructuredOutput<{ order: number[] }>(
        [
          {
            role: 'system',
            content:
              'Rank the passages by how well they answer the question. Return JSON {"order":[indices]} ' +
              'with the most relevant index first. Include only indices you are shown.',
          },
          { role: 'user', content: `Question: ${query}\n\nPassages:\n${list}` },
        ],
        RERANK_SCHEMA,
        { temperature: 0 },
      );
      const seen = new Set<number>();
      const ordered = (res.order ?? [])
        .filter(
          (i) =>
            Number.isInteger(i) &&
            i >= 0 &&
            i < pool.length &&
            !seen.has(i) &&
            seen.add(i),
        )
        .map((i) => pool[i]);
      const remaining = pool.filter((_, i) => !seen.has(i));
      return [...ordered, ...remaining, ...hits.slice(8)];
    } catch {
      return hits;
    }
  }
}

export const RERANKER_TOKEN = 'RERANKER_TOKEN';
