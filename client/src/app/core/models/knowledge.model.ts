/** Knowledge Hub models — mirror the server RAG contract. */

export type IngestStatus = 'pending' | 'parsing' | 'chunking' | 'embedding' | 'ready' | 'failed';

export interface KnowledgeDoc {
  id: string;
  title: string;
  source: string;
  mimeType: string;
  status: IngestStatus;
  chunkCount: number;
  tokenCount: number;
  topic?: string;
  tags: string[];
  warnings: string[];
  error?: string;
  createdAt: string;
}

export interface IngestResult {
  documentId: string;
  reused: boolean;
}

export interface DocumentSummary {
  tldr: string;
  keyPoints: string[];
}

export interface Flashcard {
  question: string;
  answer: string;
  source: string;
}

/** A spoken-overview script for a document (narrated client-side with TTS). */
export interface AudioOverview {
  title: string;
  script: string;
  /** True when the script is the extractive fallback, not a live-model narration. */
  fallback: boolean;
}

export type Groundedness = 'grounded' | 'partial' | 'insufficient';

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  locator: string;
  snippet: string;
  score: number;
}

export interface GroundedAnswer {
  answer: string;
  citations: Citation[];
  confidence: number;
  groundedness: Groundedness;
  suggestedNextTopic?: string;
}
