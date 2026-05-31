import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import {
  IngestStatus,
  KnowledgeDocument,
  KnowledgeDocumentDocument,
  DocSource,
} from '../schemas/knowledge-document.schema';
import {
  DocumentChunk,
  DocumentChunkDocument,
} from '../schemas/document-chunk.schema';
import { FILE_STORAGE_TOKEN, IFileStorage } from '../storage/file-storage';
import { ChunkingService } from './chunking.service';
import { DocumentParserService, ParseInput } from './document-parser.service';
import { EmbeddingService } from './embedding.service';
import { MetadataTaggingService } from './metadata-tagging.service';

export interface IngestRequest {
  userId: string;
  title: string;
  source: DocSource;
  mimeType: string;
  filename?: string;
  buffer?: Buffer;
  rawText?: string;
}

/**
 * Orchestrates upload → parse → chunk → tag → embed → store. Processing runs OFF the
 * request thread (fire-and-forget async) and updates `knowledge_documents.status` at each
 * stage so the Hub can show live progress. Idempotent per (userId, contentHash): a
 * re-upload of identical content reuses the existing ready document instead of
 * duplicating chunks.
 *
 * PRODUCTION NOTE: in this build the pipeline runs in-process (no Redis required to
 * verify end-to-end). The clean swap is a BullMQ `document-ingestion` queue — the
 * processing body below moves into a Processor unchanged.
 */
@Injectable()
export class IngestionService {
  private readonly log = new Logger(IngestionService.name);

  constructor(
    @InjectModel(KnowledgeDocument.name)
    private readonly docs: Model<KnowledgeDocumentDocument>,
    @InjectModel(DocumentChunk.name)
    private readonly chunks: Model<DocumentChunkDocument>,
    @Inject(FILE_STORAGE_TOKEN) private readonly storage: IFileStorage,
    private readonly parser: DocumentParserService,
    private readonly chunking: ChunkingService,
    private readonly tagging: MetadataTaggingService,
    private readonly embedding: EmbeddingService,
  ) {}

  /** Persists the doc + file and kicks off processing. Returns immediately. */
  async ingest(
    req: IngestRequest,
  ): Promise<{ documentId: string; reused: boolean }> {
    const content = req.rawText ?? req.buffer?.toString('utf8') ?? '';
    const contentHash = createHash('sha256')
      .update(`${req.title}::${content}`)
      .digest('hex');

    const existing = await this.docs.findOne({
      user: new Types.ObjectId(req.userId),
      contentHash,
      status: 'ready',
    });
    if (existing) return { documentId: String(existing._id), reused: true };

    let fileKey = '';
    if (req.buffer && req.source === 'upload') {
      fileKey = `${req.userId}/${randomUUID()}-${(req.filename ?? 'file').replace(/[^\w.-]/g, '_')}`;
      await this.storage.save(fileKey, req.buffer);
    }

    const doc = await this.docs.create({
      user: new Types.ObjectId(req.userId),
      title: req.title,
      source: req.source,
      fileKey,
      mimeType: req.mimeType,
      contentHash,
      status: 'pending',
    });
    const documentId = String(doc._id);

    // Off the request thread — caller gets the id and polls status.
    void this.process(documentId, {
      buffer: req.buffer,
      rawText: req.rawText,
      mimeType: req.mimeType,
      filename: req.filename,
    });

    return { documentId, reused: false };
  }

  private async setStatus(
    id: string,
    status: IngestStatus,
    patch: Partial<KnowledgeDocument> = {},
  ): Promise<void> {
    await this.docs
      .updateOne({ _id: id }, { $set: { status, ...patch } })
      .exec();
  }

  /** The full pipeline. Idempotent: clears prior chunks before inserting. */
  async process(documentId: string, input: ParseInput): Promise<void> {
    const doc = await this.docs.findById(documentId);
    if (!doc) return;
    try {
      await this.setStatus(documentId, 'parsing');
      const parsed = await this.parser.parse(input);
      if (!parsed.text.trim()) {
        await this.setStatus(documentId, 'failed', {
          warnings: parsed.warnings,
          error: parsed.warnings[0] ?? 'No extractable text in document.',
        });
        return;
      }

      await this.setStatus(documentId, 'chunking', {
        language: parsed.language,
      });
      const chunks = this.chunking.chunk(parsed);
      if (chunks.length === 0) {
        await this.setStatus(documentId, 'failed', {
          error: 'Document produced no chunks.',
        });
        return;
      }

      const tags = await this.tagging.inferDocumentTags(
        String(doc.user),
        doc.title,
        chunks,
      );

      await this.setStatus(documentId, 'embedding', {
        topic: tags.topic,
        tags: tags.tags,
      });
      const vectors = await this.embedding.embedAll(chunks.map((c) => c.text));
      const dimension = vectors[0]?.length ?? 0;

      await this.chunks
        .deleteMany({ document: new Types.ObjectId(documentId) })
        .exec();
      await this.chunks.insertMany(
        chunks.map((c, i) => ({
          document: new Types.ObjectId(documentId),
          user: doc.user,
          documentTitle: doc.title,
          chunkIndex: i,
          text: c.text,
          embedding: vectors[i],
          headingPath: c.headingPath,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          tStart: c.tStart,
          tEnd: c.tEnd,
          charStart: c.charStart,
          charEnd: c.charEnd,
          tokenCount: c.tokenCount,
          keywords: this.tagging.keywordsFor(c.text),
          language: parsed.language,
        })),
      );

      await this.setStatus(documentId, 'ready', {
        chunkCount: chunks.length,
        tokenCount: chunks.reduce((s, c) => s + c.tokenCount, 0),
        embeddingProvider: this.embedding.provider,
        embeddingDimension: dimension,
        warnings: parsed.warnings,
      });
      this.log.log(
        `Ingested "${doc.title}" → ${chunks.length} chunks (${this.embedding.provider}, dim ${dimension}).`,
      );
    } catch (err) {
      this.log.error(
        `Ingestion failed for ${documentId}: ${(err as Error).message}`,
      );
      await this.setStatus(documentId, 'failed', {
        error: (err as Error).message,
      });
    }
  }
}
