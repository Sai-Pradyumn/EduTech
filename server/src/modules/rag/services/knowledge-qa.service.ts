import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  KnowledgeQa,
  KnowledgeQaDocument,
} from '../schemas/knowledge-qa.schema';

export interface QaTurnView {
  id: string;
  question: string;
  answer: string;
  sources: Record<string, unknown>[];
  confidence: number;
  createdAt: string;
}

/** Persists the Knowledge Hub's grounded Q&A so the transcript follows the learner across devices. */
@Injectable()
export class KnowledgeQaService {
  /** Keep the most recent N turns per user. */
  private static readonly CAP = 50;

  constructor(
    @InjectModel(KnowledgeQa.name)
    private readonly model: Model<KnowledgeQaDocument>,
  ) {}

  async save(
    userId: string,
    input: {
      question: string;
      answer: string;
      sources?: Record<string, unknown>[];
      confidence?: number;
    },
  ): Promise<QaTurnView> {
    const created = await this.model.create({
      user: new Types.ObjectId(userId),
      question: input.question,
      answer: input.answer,
      sources: input.sources ?? [],
      confidence: input.confidence ?? 0,
    });
    // Best-effort prune of anything beyond the cap.
    const ids = await this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(KnowledgeQaService.CAP)
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>();
    if (ids.length) {
      await this.model.deleteMany({ _id: { $in: ids.map((d) => d._id) } });
    }
    return this.toView(created);
  }

  async list(userId: string): Promise<QaTurnView[]> {
    const rows = await this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: 1 })
      .limit(KnowledgeQaService.CAP)
      .exec();
    return rows.map((r) => this.toView(r));
  }

  async clear(userId: string): Promise<{ deleted: number }> {
    const res = await this.model
      .deleteMany({ user: new Types.ObjectId(userId) })
      .exec();
    return { deleted: res.deletedCount ?? 0 };
  }

  private toView(r: KnowledgeQaDocument): QaTurnView {
    return {
      id: String(r._id),
      question: r.question,
      answer: r.answer,
      sources: r.sources ?? [],
      confidence: r.confidence,
      createdAt:
        (
          r as KnowledgeQaDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }
}
