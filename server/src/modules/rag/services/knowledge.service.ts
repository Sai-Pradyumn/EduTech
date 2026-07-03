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

/** A spoken-overview script for a document (played with browser TTS client-side). */
export interface AudioOverview {
  title: string;
  /** Plain conversational narration, ~300–450 words, no markdown. */
  script: string;
  /** True when the script is the extractive fallback, not a live-model narration. */
  fallback: boolean;
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

  /** Edit a document's user-facing metadata. A title change propagates to chunk
   *  citation labels so grounded answers stay consistent. */
  async update(
    userId: string,
    id: string,
    input: { title?: string; tags?: string[] },
  ): Promise<DocumentView> {
    const doc = await this.owned(userId, id);
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (t) {
        doc.title = t.slice(0, 200);
        await this.chunks
          .updateMany(
            { document: doc._id },
            { $set: { documentTitle: doc.title } },
          )
          .exec();
      }
    }
    if (input.tags !== undefined) {
      const seen = new Set<string>();
      doc.tags = input.tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t && !seen.has(t) && seen.add(t))
        .slice(0, 20);
    }
    await doc.save();
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

    let result: DocumentSummary | null;
    try {
      result = await this.ai.generateStructuredOutput<DocumentSummary>(
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
        { mockFactory: fallback, meta: { operation: 'rag.summary' } },
      );
    } catch {
      result = null; // extractive fallback below — a summary is always produced
    }
    await this.ai.logUsage({
      userId,
      agentType: AgentType.Rag,
      operation: 'rag.summary',
    });
    return result?.tldr ? result : fallback();
  }

  /**
   * NotebookLM-style audio overview: a conversational narration script for the
   * document, grounded ONLY in its chunks — the client plays it with browser
   * TTS. Live model when available; an honest extractive script otherwise.
   */
  async audioOverview(userId: string, id: string): Promise<AudioOverview> {
    const doc = await this.owned(userId, id);
    const chunks = await this.docChunks(doc._id, 10);
    const sample = chunks
      .map((c) => c.text)
      .join('\n')
      .slice(0, 2600);

    const fallback = (): AudioOverview => {
      const body = chunks
        .slice(0, 6)
        .map((c) => c.text.replace(/\s+/g, ' ').replace(/^…\s*/, '').trim())
        .filter(Boolean)
        .map((s) => (s.length > 220 ? `${s.slice(0, 220)}…` : s))
        .join(' Next: ');
      return {
        title: doc.title,
        script:
          `Here is a quick overview of "${doc.title}". ` +
          (body ||
            'The document is still being processed, so there is nothing to narrate yet.') +
          ` That covers the main sections of ${doc.title}. For a narrated deep dive, connect a live AI provider.`,
        fallback: true,
      };
    };

    if (!this.ai.isLive || chunks.length === 0) return fallback();
    try {
      const out = await this.ai.generateStructuredOutput<{ script: string }>(
        [
          {
            role: 'system',
            content:
              'Write a spoken AUDIO OVERVIEW of the document — a warm, clear narration a learner ' +
              'listens to while commuting. Ground it ONLY in the provided text. Walk through the ' +
              'main ideas in order, briefly explain any jargon the text uses, and end with the two ' +
              'or three takeaways worth remembering. Plain sentences only: no markdown, no headings, ' +
              'no lists, no stage directions. 300–450 words.',
          },
          { role: 'user', content: `Title: ${doc.title}\n\n${sample}` },
        ],
        {
          type: 'object',
          properties: {
            script: { type: 'string', minLength: 600, maxLength: 4200 },
          },
          required: ['script'],
        },
        {
          temperature: 0.5,
          meta: {
            userId,
            agentType: AgentType.Rag,
            operation: 'rag.audio_overview',
          },
          mockFactory: () => ({ script: '' }),
        },
      );
      const script = (out.script ?? '').trim();
      return script.length >= 400
        ? { title: doc.title, script, fallback: false }
        : fallback();
    } catch {
      return fallback();
    }
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
