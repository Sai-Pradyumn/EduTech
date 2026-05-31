import { Injectable, Logger } from '@nestjs/common';
import {
  ChunkHit,
  RetrievalScope,
  VectorQuery,
} from './vector-store.interface';
import { KeywordVectorStore } from './keyword-vector-store';

/**
 * Atlas-backed store (VECTOR_STORE_PROVIDER=atlas). Dense path uses MongoDB Atlas
 * `$vectorSearch` (ANN) over `document_chunks.embedding`.
 *
 * PLACEHOLDER NOTE: a local/standalone MongoDB has no `$vectorSearch` aggregation
 * stage (Atlas-only). This implementation attempts the Atlas path and transparently
 * falls back to the in-process cosine ranking (inherited from KeywordVectorStore) when
 * the stage is unavailable — so selecting `atlas` never breaks, and flips to true ANN
 * automatically once an Atlas connection + a `vectorSearch` index exist. The sparse
 * path is inherited unchanged.
 */
@Injectable()
export class MongoDbVectorStore extends KeywordVectorStore {
  override readonly name: string = 'mongodb';
  private readonly log = new Logger(MongoDbVectorStore.name);
  private atlasUnavailable = false;

  override async search(
    query: VectorQuery,
    scope: RetrievalScope,
    k: number,
  ): Promise<ChunkHit[]> {
    if (this.atlasUnavailable) return super.search(query, scope, k);
    try {
      const filter = this.scopeFilter(scope);
      const results = await this.chunks
        .aggregate<{
          _id: unknown;
          document: unknown;
          documentTitle: string;
          text: string;
          headingPath?: string;
          pageStart?: number;
          pageEnd?: number;
          tStart?: number;
          tEnd?: number;
          score: number;
        }>([
          {
            $vectorSearch: {
              index: 'document_chunks_vector',
              path: 'embedding',
              queryVector: query.embedding,
              numCandidates: k * 20,
              limit: k,
              filter,
            },
          },
          { $addFields: { score: { $meta: 'vectorSearchScore' } } },
        ])
        .exec();
      return results.map((r) => ({
        chunkId: String(r._id),
        documentId: String(r.document),
        documentTitle: r.documentTitle,
        text: r.text,
        score: Math.max(0, Math.min(1, r.score)),
        headingPath: r.headingPath,
        pageStart: r.pageStart,
        pageEnd: r.pageEnd,
        tStart: r.tStart,
        tEnd: r.tEnd,
      }));
    } catch (err) {
      this.atlasUnavailable = true;
      this.log.warn(
        `Atlas $vectorSearch unavailable (${(err as Error).message}). Falling back to in-process cosine ranking for the rest of this process.`,
      );
      return super.search(query, scope, k);
    }
  }
}
