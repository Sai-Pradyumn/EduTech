import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  KnowledgeDocument,
  KnowledgeDocumentSchema,
} from './schemas/knowledge-document.schema';
import {
  DocumentChunk,
  DocumentChunkSchema,
} from './schemas/document-chunk.schema';
import { KnowledgeQa, KnowledgeQaSchema } from './schemas/knowledge-qa.schema';
import { KnowledgeController } from './knowledge.controller';
import { IngestionService } from './services/ingestion.service';
import { KnowledgeService } from './services/knowledge.service';
import { KnowledgeQaService } from './services/knowledge-qa.service';
import { DocumentParserService } from './services/document-parser.service';
import { ChunkingService } from './services/chunking.service';
import { MetadataTaggingService } from './services/metadata-tagging.service';
import { EmbeddingService } from './services/embedding.service';
import { CitationService } from './services/citation.service';
import { RagAnswerService } from './services/rag-answer.service';
import { HybridRetrieverService } from './vector/hybrid-retriever.service';
import { vectorStoreFactory } from './vector/vector-store.factory';
import { LlmReranker, RERANKER_TOKEN } from './vector/reranker';
import { fileStorageFactory } from './storage/file-storage';

/**
 * Advanced RAG Knowledge Engine: ingestion → parse → chunk → tag → embed → store →
 * hybrid retrieve → rerank → cited grounded answer. Backend selected by
 * VECTOR_STORE_PROVIDER (keyword default / atlas). Exports RagAnswerService so the
 * RAG agent (in AgentsModule) can answer through the Agent OS.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeDocument.name, schema: KnowledgeDocumentSchema },
      { name: DocumentChunk.name, schema: DocumentChunkSchema },
      { name: KnowledgeQa.name, schema: KnowledgeQaSchema },
    ]),
  ],
  controllers: [KnowledgeController],
  providers: [
    IngestionService,
    KnowledgeService,
    KnowledgeQaService,
    DocumentParserService,
    ChunkingService,
    MetadataTaggingService,
    EmbeddingService,
    CitationService,
    RagAnswerService,
    HybridRetrieverService,
    vectorStoreFactory,
    fileStorageFactory,
    { provide: RERANKER_TOKEN, useClass: LlmReranker },
  ],
  exports: [RagAnswerService, KnowledgeService, IngestionService],
})
export class RagModule {}
