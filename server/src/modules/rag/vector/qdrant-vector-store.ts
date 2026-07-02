import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { DocumentChunkDocument } from '../schemas/document-chunk.schema';
import { KeywordVectorStore } from './keyword-vector-store';
import {
  ChunkHit,
  RetrievalScope,
  VectorQuery,
} from './vector-store.interface';

const SYNC_TTL_MS = 5 * 60_000;
const UPSERT_BATCH = 100;
const REQUEST_TIMEOUT_MS = 4_000;

interface QdrantPoint {
  id: string;
  score?: number;
  payload?: Record<string, unknown>;
}

/**
 * Real vector database backend (Qdrant) for the RAG dense path. Architecture:
 *
 * - MongoDB stays the durable source of truth for chunks (and keeps serving the
 *   sparse/keyword arm of the hybrid retriever, inherited from KeywordVectorStore).
 * - Qdrant is the ANN index for the dense arm. Consistency is pull-based: before
 *   a user's dense search, a TTL'd count comparison (Mongo chunks vs Qdrant
 *   points) detects drift — new uploads, deletions — and resyncs just that user.
 *   No coupling into the ingestion/removal paths; brand-new content is still
 *   found immediately by the sparse arm while the dense index catches up.
 * - One collection per embedding dimension (asta_chunks_d{N}), so switching
 *   embedding providers can never mix incompatible vectors.
 * - Every Qdrant failure degrades to the in-process cosine search over Mongo —
 *   RAG never breaks because the vector DB is down.
 *
 * Talks to Qdrant's REST API with global fetch — no extra dependency.
 */
export class QdrantVectorStore extends KeywordVectorStore {
  override readonly name = 'qdrant';
  private readonly logger = new Logger(QdrantVectorStore.name);
  private readonly collections = new Set<string>();
  private readonly synced = new Map<string, number>();

  constructor(
    chunks: Model<DocumentChunkDocument>,
    private readonly baseUrl: string,
  ) {
    super(chunks);
  }

  override async search(
    query: VectorQuery,
    scope: RetrievalScope,
    k: number,
  ): Promise<ChunkHit[]> {
    const dim = query.embedding.length;
    if (!dim) return super.search(query, scope, k);
    const collection = `asta_chunks_d${dim}`;
    try {
      await this.ensureCollection(collection, dim);
      await this.ensureSynced(collection, scope.userId, dim);

      const must: Record<string, unknown>[] = [
        { key: 'user', match: { value: scope.userId } },
      ];
      if (scope.documentIds?.length) {
        must.push({ key: 'document', match: { any: scope.documentIds } });
      }
      const res = await this.qdrant<{ result: QdrantPoint[] }>(
        'POST',
        `/collections/${collection}/points/search`,
        {
          vector: query.embedding,
          limit: k,
          filter: { must },
          with_payload: true,
        },
      );
      return (res.result ?? [])
        .map((p) => this.pointToHit(p))
        .filter((h): h is ChunkHit => !!h && h.score > 0);
    } catch (err) {
      this.logger.warn(
        `Qdrant search failed (${(err as Error).message}) — falling back to in-process cosine.`,
      );
      return super.search(query, scope, k);
    }
  }

  // ─────────────────────── sync (pull-based consistency) ───────────────────────

  private async ensureSynced(
    collection: string,
    userId: string,
    dim: number,
  ): Promise<void> {
    const key = `${collection}:${userId}`;
    const last = this.synced.get(key);
    if (last && Date.now() - last < SYNC_TTL_MS) return;

    const [mongoCount, qdrantCount] = await Promise.all([
      this.chunks.countDocuments(this.scopeFilter({ userId })).exec(),
      this.countPoints(collection, userId),
    ]);

    if (mongoCount !== qdrantCount) {
      this.logger.log(
        `Resyncing ${userId} into ${collection} (mongo=${mongoCount}, qdrant=${qdrantCount}).`,
      );
      await this.qdrant(
        'POST',
        `/collections/${collection}/points/delete?wait=true`,
        {
          filter: { must: [{ key: 'user', match: { value: userId } }] },
        },
      );
      const docs = await this.loadScoped({ userId });
      const points = docs
        .filter((c) => c.embedding?.length === dim)
        .map((c) => ({
          id: this.pointId(String(c._id)),
          vector: c.embedding,
          payload: {
            user: userId,
            document: String(c.document),
            chunkId: String(c._id),
            documentTitle: c.documentTitle,
            text: c.text,
            headingPath: c.headingPath ?? null,
            pageStart: c.pageStart ?? null,
            pageEnd: c.pageEnd ?? null,
            tStart: c.tStart ?? null,
            tEnd: c.tEnd ?? null,
          },
        }));
      for (let i = 0; i < points.length; i += UPSERT_BATCH) {
        await this.qdrant(
          'PUT',
          `/collections/${collection}/points?wait=true`,
          {
            points: points.slice(i, i + UPSERT_BATCH),
          },
        );
      }
    }
    this.synced.set(key, Date.now());
  }

  private async countPoints(
    collection: string,
    userId: string,
  ): Promise<number> {
    const res = await this.qdrant<{ result?: { count?: number } }>(
      'POST',
      `/collections/${collection}/points/count`,
      {
        filter: { must: [{ key: 'user', match: { value: userId } }] },
        exact: true,
      },
    );
    return res.result?.count ?? 0;
  }

  private async ensureCollection(name: string, dim: number): Promise<void> {
    if (this.collections.has(name)) return;
    const exists = await fetch(`${this.baseUrl}/collections/${name}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!exists.ok) {
      await this.qdrant('PUT', `/collections/${name}`, {
        vectors: { size: dim, distance: 'Cosine' },
      });
      // Payload indexes for the filters we always use (best-effort).
      for (const field of ['user', 'document']) {
        await this.qdrant('PUT', `/collections/${name}/index?wait=true`, {
          field_name: field,
          field_schema: 'keyword',
        }).catch(() => undefined);
      }
    }
    this.collections.add(name);
  }

  // ─────────────────────────── plumbing ───────────────────────────

  /** Qdrant point ids must be UUIDs; a Mongo ObjectId (24 hex) pads to one. */
  private pointId(hex24: string): string {
    const h = hex24.padEnd(24, '0');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 24)}00000000`;
  }

  private pointToHit(p: QdrantPoint): ChunkHit | null {
    const pl = p.payload;
    if (!pl || typeof pl.text !== 'string') return null;
    const str = (v: unknown, dflt = ''): string =>
      typeof v === 'string' ? v : dflt;
    return {
      chunkId: str(pl.chunkId, p.id),
      documentId: str(pl.document),
      documentTitle: str(pl.documentTitle),
      text: pl.text,
      score: Math.max(0, Math.min(1, p.score ?? 0)),
      headingPath: (pl.headingPath as string) ?? undefined,
      pageStart: (pl.pageStart as number) ?? undefined,
      pageEnd: (pl.pageEnd as number) ?? undefined,
      tStart: (pl.tStart as number) ?? undefined,
      tEnd: (pl.tEnd as number) ?? undefined,
    };
  }

  private async qdrant<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Qdrant ${method} ${path} → ${res.status} ${detail.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }
}
