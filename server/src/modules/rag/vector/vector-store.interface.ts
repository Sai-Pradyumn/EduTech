/** Provider-agnostic vector store contract. Swap impls via VECTOR_STORE_PROVIDER. */

export interface StoredChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  userId: string;
  text: string;
  embedding: number[];
  headingPath?: string;
  pageStart?: number;
  pageEnd?: number;
  tStart?: number;
  tEnd?: number;
}

export interface ChunkHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  text: string;
  score: number; // 0..1 normalized
  headingPath?: string;
  pageStart?: number;
  pageEnd?: number;
  tStart?: number;
  tEnd?: number;
}

export interface RetrievalScope {
  userId: string;
  /** Restrict retrieval to these documents; omit for the user's whole corpus. */
  documentIds?: string[];
}

export interface VectorQuery {
  text: string;
  embedding: number[];
}

export interface IVectorStore {
  readonly name: string;
  /** Dense / ANN path. */
  search(
    query: VectorQuery,
    scope: RetrievalScope,
    k: number,
  ): Promise<ChunkHit[]>;
  /** Sparse / keyword path (term overlap) — fused with dense by the hybrid retriever. */
  keywordSearch(
    query: VectorQuery,
    scope: RetrievalScope,
    k: number,
  ): Promise<ChunkHit[]>;
}

export const VECTOR_STORE_TOKEN = 'VECTOR_STORE_TOKEN';
