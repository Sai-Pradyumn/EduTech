import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { DocumentChunk, DocumentChunkDocument } from '../schemas/document-chunk.schema';
import { cosine, termOverlap, tokenize } from './scoring';
import { ChunkHit, IVectorStore, RetrievalScope, VectorQuery } from './vector-store.interface';

/**
 * Default backend — needs no Atlas. Loads the scoped chunks from MongoDB and ranks
 * them in-process: cosine over the (deterministic, hashed-when-mock) embedding for the
 * dense path, term-overlap over the text for the sparse path. Both return identical
 * ChunkHit[] so the rest of the pipeline is backend-agnostic.
 */
@Injectable()
export class KeywordVectorStore implements IVectorStore {
  readonly name: string = 'keyword';

  constructor(
    @InjectModel(DocumentChunk.name) protected readonly chunks: Model<DocumentChunkDocument>,
  ) {}

  protected scopeFilter(scope: RetrievalScope): FilterQuery<DocumentChunkDocument> {
    const filter: FilterQuery<DocumentChunkDocument> = { user: new Types.ObjectId(scope.userId) };
    if (scope.documentIds?.length) {
      filter.document = { $in: scope.documentIds.map((id) => new Types.ObjectId(id)) };
    }
    return filter;
  }

  /** Loads scoped chunks once; callers rank in-memory. Bounded for safety. */
  protected async loadScoped(scope: RetrievalScope): Promise<DocumentChunkDocument[]> {
    return this.chunks.find(this.scopeFilter(scope)).limit(2000).lean<DocumentChunkDocument[]>().exec();
  }

  protected toHit(c: DocumentChunkDocument, score: number): ChunkHit {
    return {
      chunkId: String(c._id),
      documentId: String(c.document),
      documentTitle: c.documentTitle,
      text: c.text,
      score,
      headingPath: c.headingPath,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      tStart: c.tStart,
      tEnd: c.tEnd,
    };
  }

  async search(query: VectorQuery, scope: RetrievalScope, k: number): Promise<ChunkHit[]> {
    const docs = await this.loadScoped(scope);
    return docs
      .map((c) => this.toHit(c, cosine(query.embedding, c.embedding)))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async keywordSearch(query: VectorQuery, scope: RetrievalScope, k: number): Promise<ChunkHit[]> {
    const terms = tokenize(query.text);
    const docs = await this.loadScoped(scope);
    return docs
      .map((c) => this.toHit(c, termOverlap(terms, c.text)))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
