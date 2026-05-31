import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import {
  KnowledgeDocument,
  KnowledgeDocumentDocument,
} from '../schemas/knowledge-document.schema';
import {
  DocumentChunk,
  DocumentChunkDocument,
} from '../schemas/document-chunk.schema';
import { FILE_STORAGE_TOKEN, IFileStorage } from '../storage/file-storage';

export interface DocumentView {
  id: string;
  title: string;
  source: string;
  mimeType: string;
  status: string;
  chunkCount: number;
  tokenCount: number;
  topic?: string;
  tags: string[];
  warnings: string[];
  error?: string;
  createdAt: string;
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

/** Document-level operations for the Knowledge Hub (listing, deletion, summary, flashcards). */
@Injectable()
export class KnowledgeService {
  constructor(
    @InjectModel(KnowledgeDocument.name)
    private readonly docs: Model<KnowledgeDocumentDocument>,
    @InjectModel(DocumentChunk.name)
    private readonly chunks: Model<DocumentChunkDocument>,
    @Inject(FILE_STORAGE_TOKEN) private readonly storage: IFileStorage,
    private readonly ai: AiService,
  ) {}

  async list(userId: string): Promise<DocumentView[]> {
    const docs = await this.docs
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean<KnowledgeDocumentDocument[]>()
      .exec();
    return docs.map((d) => this.toView(d));
  }

  async get(userId: string, id: string): Promise<DocumentView> {
    const doc = await this.owned(userId, id);
    return this.toView(doc);
  }

  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.owned(userId, id);
    await this.chunks.deleteMany({ document: doc._id }).exec();
    if (doc.fileKey) await this.storage.delete(doc.fileKey);
    await this.docs.deleteOne({ _id: doc._id }).exec();
  }

  async summary(userId: string, id: string): Promise<DocumentSummary> {
    const doc = await this.owned(userId, id);
    const chunks = await this.docChunks(doc._id, 8);
    const sample = chunks
      .map((c) => c.text)
      .join('\n')
      .slice(0, 2000);

    const fallback = (): DocumentSummary => {
      const keyPoints = chunks
        .slice(0, 5)
        .map((c) => {
          const s = c.text.replace(/\s+/g, ' ').replace(/^…\s*/, '').trim();
          return s.length > 160 ? `${s.slice(0, 160)}…` : s;
        })
        .filter(Boolean);
      return {
        tldr: `“${doc.title}” covers ${doc.topic ?? (doc.tags.slice(0, 3).join(', ') || 'the uploaded material')} across ${doc.chunkCount} sections.`,
        keyPoints,
      };
    };

    const result = await this.ai.generateStructuredOutput<DocumentSummary>(
      [
        {
          role: 'system',
          content:
            'Summarize the document grounded ONLY in the provided text. Return a TL;DR and key points.',
        },
        { role: 'user', content: `Title: ${doc.title}\n\n${sample}` },
      ],
      {
        type: 'object',
        properties: {
          tldr: { type: 'string' },
          keyPoints: { type: 'array', items: { type: 'string' } },
        },
        required: ['tldr', 'keyPoints'],
      },
      { mockFactory: fallback },
    );
    await this.ai.logUsage({
      userId,
      agentType: AgentType.Rag,
      operation: 'rag.summary',
    });
    return result?.tldr ? result : fallback();
  }

  async flashcards(
    userId: string,
    id: string,
    count = 6,
  ): Promise<Flashcard[]> {
    const doc = await this.owned(userId, id);
    const chunks = await this.docChunks(doc._id, count);
    return chunks.map((c) => {
      const topic = (c.keywords[0] ?? doc.topic ?? 'this topic').replace(
        /\b\w/g,
        (x) => x.toUpperCase(),
      );
      const sentence = c.text.replace(/\s+/g, ' ').replace(/^…\s*/, '').trim();
      return {
        question: `What does "${doc.title}" say about ${topic}?`,
        answer: sentence.length > 240 ? `${sentence.slice(0, 240)}…` : sentence,
        source: c.headingPath ?? doc.title,
      };
    });
  }

  /** Content sample for downstream generators (e.g. doc-grounded quizzes). */
  async sampleChunks(
    userId: string,
    documentId: string,
    limit = 8,
  ): Promise<{ text: string; headingPath?: string; keywords: string[] }[]> {
    const doc = await this.owned(userId, documentId);
    const chunks = await this.docChunks(doc._id, limit);
    return chunks.map((c) => ({
      text: c.text,
      headingPath: c.headingPath,
      keywords: c.keywords ?? [],
    }));
  }

  private async owned(
    userId: string,
    id: string,
  ): Promise<KnowledgeDocumentDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Document not found');
    const doc = await this.docs.findOne({
      _id: id,
      user: new Types.ObjectId(userId),
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  private async docChunks(
    docId: Types.ObjectId,
    limit: number,
  ): Promise<DocumentChunkDocument[]> {
    return this.chunks
      .find({ document: docId })
      .sort({ chunkIndex: 1 })
      .limit(limit)
      .lean<DocumentChunkDocument[]>()
      .exec();
  }

  private toView(d: KnowledgeDocumentDocument): DocumentView {
    return {
      id: String(d._id),
      title: d.title,
      source: d.source,
      mimeType: d.mimeType,
      status: d.status,
      chunkCount: d.chunkCount,
      tokenCount: d.tokenCount,
      topic: d.topic,
      tags: d.tags ?? [],
      warnings: d.warnings ?? [],
      error: d.error,
      createdAt:
        (
          d as KnowledgeDocumentDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }
}
