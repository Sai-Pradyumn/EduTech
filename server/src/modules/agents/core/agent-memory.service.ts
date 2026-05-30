import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentMemory, AgentMemoryDocument, MemoryKind } from '../schemas/agent-memory.schema';
import { MemoryItem } from './agent.interface';

/**
 * Long-lived personalization memory. Stores compact, useful facts (not raw chat),
 * and retrieves the most relevant ones before an agent responds.
 */
@Injectable()
export class AgentMemoryService {
  constructor(
    @InjectModel(AgentMemory.name) private readonly model: Model<AgentMemoryDocument>,
  ) {}

  /** Top memories by weight for a user, for prompt grounding. */
  async retrieve(userId: string, limit = 12): Promise<MemoryItem[]> {
    const docs = await this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ weight: -1, updatedAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((d) => ({ kind: d.kind, content: d.content }));
  }

  /** Upsert a memory; dedupes by (kind, content) and bumps weight on repeat. */
  async remember(userId: string, kind: MemoryKind, content: string, weight = 1, source = 'agent'): Promise<void> {
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
    await this.model.deleteOne({ _id: id, user: new Types.ObjectId(userId) }).exec();
  }
}
