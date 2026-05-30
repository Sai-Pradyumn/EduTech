import { Injectable } from '@nestjs/common';
import { ChunkHit } from './vector-store.interface';

/**
 * Reorders fused hits before truncation to top-k. A cross-encoder / LLM-rerank
 * implementation drops in here without touching callers.
 */
export interface IReranker {
  rerank(query: string, hits: ChunkHit[]): Promise<ChunkHit[]>;
}

/** Default — passes hits through unchanged (PLACEHOLDER for a real reranker). */
@Injectable()
export class NoopReranker implements IReranker {
  async rerank(_query: string, hits: ChunkHit[]): Promise<ChunkHit[]> {
    return hits;
  }
}

export const RERANKER_TOKEN = 'RERANKER_TOKEN';
