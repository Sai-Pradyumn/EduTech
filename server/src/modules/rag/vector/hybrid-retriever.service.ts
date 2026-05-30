import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { AiService } from '../../ai/ai.service';
import { IReranker, RERANKER_TOKEN } from './reranker';
import { ChunkHit, IVectorStore, RetrievalScope, VECTOR_STORE_TOKEN } from './vector-store.interface';

const RRF_K = 60; // Reciprocal Rank Fusion constant.
// With real embeddings, a strong semantic match with NO lexical overlap is still valid
// recall — but only above this cosine floor, so we don't reopen the hallucination door.
const SEMANTIC_FLOOR = 0.55;

/**
 * Hybrid retrieval: runs the dense (vector) and sparse (keyword) paths in parallel,
 * fuses them with Reciprocal Rank Fusion, reranks the fused top-(k*3), then truncates
 * to top-k. Recovers exact-term matches embeddings miss while keeping semantic recall.
 */
@Injectable()
export class HybridRetrieverService {
  private readonly hybrid: boolean;

  constructor(
    @Inject(VECTOR_STORE_TOKEN) private readonly store: IVectorStore,
    @Inject(RERANKER_TOKEN) private readonly reranker: IReranker,
    private readonly ai: AiService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.hybrid = config.get('rag.hybrid', { infer: true });
  }

  async retrieve(queryText: string, scope: RetrievalScope, k: number): Promise<ChunkHit[]> {
    const embedding = await this.ai.generateEmbedding(queryText);
    const query = { text: queryText, embedding };
    const wide = k * 3;

    if (!this.hybrid) {
      const dense = await this.store.search(query, scope, wide);
      const reranked = await this.reranker.rerank(queryText, dense);
      return reranked.filter((h) => h.score > 0).slice(0, k);
    }

    const [dense, sparse] = await Promise.all([
      this.store.search(query, scope, wide),
      this.store.keywordSearch(query, scope, wide),
    ]);

    const fused = this.fuse(dense, sparse);
    const reranked = await this.reranker.rerank(queryText, fused);
    return reranked.slice(0, k);
  }

  /** Real embeddings (a live, embeddings-capable provider) unlock semantic recall. */
  private get semanticRecall(): boolean {
    return this.ai.isLive;
  }

  /**
   * Fuses the dense and sparse rankings. RRF decides ORDER (it's a good rank combiner),
   * but the `score` we surface is an ABSOLUTE relevance — dominated by lexical (term)
   * overlap, with dense similarity only counted when it's strong. This is what the answer
   * layer thresholds on for refusal: a normalized RRF score would always look confident
   * even for an off-corpus question (every list has a #1), defeating anti-hallucination.
   */
  private fuse(dense: ChunkHit[], sparse: ChunkHit[]): ChunkHit[] {
    const acc = new Map<string, { hit: ChunkHit; rrf: number; dense: number; sparse: number }>();
    const add = (list: ChunkHit[], kind: 'dense' | 'sparse'): void => {
      list.forEach((hit, rank) => {
        const entry =
          acc.get(hit.chunkId) ?? { hit, rrf: 0, dense: 0, sparse: 0 };
        entry.rrf += 1 / (RRF_K + rank + 1);
        entry[kind] = Math.max(entry[kind], hit.score);
        // Prefer the richest provenance we've seen for this chunk.
        if (!entry.hit.headingPath && hit.headingPath) entry.hit = hit;
        acc.set(hit.chunkId, entry);
      });
    };
    add(dense, 'dense');
    add(sparse, 'sparse');

    return [...acc.values()]
      .sort((a, b) => b.rrf - a.rrf) // RRF decides order.
      .map(({ hit, dense: d, sparse: s }) => {
        // Lexical overlap is a NECESSARY condition for grounding on the keyword/mock
        // backend: the mock's hashed-embedding cosine produces spurious matches, so dense
        // similarity is only allowed to REFINE the score of a lexically-relevant chunk,
        // never to create relevance from zero.
        let relevance = s > 0 ? Math.min(1, 0.7 * s + 0.3 * Math.min(1, d)) : 0;
        // With a real embedding backend, allow a STRONG semantic-only match (no shared
        // terms) to ground — but gated by SEMANTIC_FLOOR so weak cosine can't fabricate it.
        if (relevance === 0 && this.semanticRecall && d >= SEMANTIC_FLOOR) {
          relevance = Math.min(1, 0.85 * d);
        }
        return { ...hit, score: relevance };
      })
      .filter((h) => h.score > 0);
  }
}
