import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AgentMemory,
  AgentMemoryDocument,
  MemoryKind,
} from '../schemas/agent-memory.schema';
import { MemoryItem } from './agent.interface';

/**
 * Long-lived personalization memory. Stores compact, useful facts (not raw chat),
 * and retrieves the most relevant ones before an agent responds.
 */
@Injectable()
export class AgentMemoryService {
  constructor(
    @InjectModel(AgentMemory.name)
    private readonly model: Model<AgentMemoryDocument>,
  ) {}

  /** Top memories by weight for a user, for prompt grounding. */
  async retrieve(
    userId: string,
    query?: string,
    limit = 8,
  ): Promise<MemoryItem[]> {
    if (!query?.trim()) {
      const docs = await this.model
        .find({ user: new Types.ObjectId(userId) })
        .sort({ weight: -1, updatedAt: -1 })
        .limit(limit)
        .exec();
      return docs.map((d) => ({ kind: d.kind, content: d.content }));
    }

    // Relevance-ranked recall: rank a wider pool by term overlap blended with weight, so
    // the agent recalls what's pertinent to THIS message (cheap, no per-turn embedding).
    const pool = await this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ weight: -1, updatedAt: -1 })
      .limit(50)
      .exec();
    const terms = new Set(this.tokenize(query));
    const maxWeight = Math.max(1, ...pool.map((d) => d.weight ?? 1));
    return pool
      .map((d) => ({
        item: { kind: d.kind, content: d.content },
        score:
          0.6 * this.overlap(terms, d.content) +
          0.4 * ((d.weight ?? 1) / maxWeight),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.item);
  }

  private tokenize(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length > 2,
    );
  }

  private overlap(terms: Set<string>, content: string): number {
    if (terms.size === 0) return 0;
    const docTerms = new Set(this.tokenize(content));
    let hit = 0;
    for (const t of terms) if (docTerms.has(t)) hit++;
    return hit / terms.size;
  }

  /** Upsert a memory; dedupes by (kind, content) and bumps weight on repeat. */
  async remember(
    userId: string,
    kind: MemoryKind,
    content: string,
    weight = 1,
    source = 'agent',
  ): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;
    await this.model
      .updateOne(
        { user: new Types.ObjectId(userId), kind, content: trimmed },
        { $set: { source }, $inc: { weight } },
        { upsert: true },
      )
      .exec();
  }

  async forget(userId: string, id: string): Promise<void> {
    await this.model
      .deleteOne({ _id: id, user: new Types.ObjectId(userId) })
      .exec();
  }
}
