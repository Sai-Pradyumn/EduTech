import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { ConfirmMemoryDto } from './dto/memory.dto';
import {
  LearnerMemory,
  LearnerMemoryDocument,
} from './schemas/learner-memory.schema';

export interface LearnerMemoryView {
  id: string;
  type: string;
  value: string;
  summary: string;
  createdAt: string | null;
}

function toView(m: LearnerMemoryDocument): LearnerMemoryView {
  return {
    id: String(m._id),
    type: m.type,
    value: m.value,
    summary: m.summary,
    createdAt: (m as { createdAt?: Date }).createdAt?.toISOString() ?? null,
  };
}

/**
 * Phase E · Memory updates. Persists facts Asta remembers — but only after the
 * learner confirms. Every decision (save/dismiss) is written to the audit trail.
 */
@Injectable()
export class MemoryService {
  constructor(
    @InjectModel(LearnerMemory.name)
    private readonly memories: Model<LearnerMemoryDocument>,
    private readonly audit: AuditService,
  ) {}

  /** Save or dismiss a suggested memory; always audited. Returns the saved row (or null on dismiss). */
  async confirm(
    userId: string,
    email: string,
    dto: ConfirmMemoryDto,
  ): Promise<LearnerMemoryView | null> {
    await this.audit.record({
      actorId: userId,
      actorEmail: email,
      action: `memory.${dto.decision}`,
      targetType: 'learner_memory',
      metadata: { type: dto.type, value: dto.value },
    });

    if (dto.decision === 'dismiss') return null;

    const created = await this.memories.create({
      user: new Types.ObjectId(userId),
      type: dto.type,
      value: dto.value,
      summary: dto.summary,
      status: 'saved',
      source: 'asta_os',
    });
    return toView(created);
  }

  /** The learner's saved memories, newest first. */
  async list(userId: string): Promise<LearnerMemoryView[]> {
    const rows = await this.memories
      .find({ user: new Types.ObjectId(userId), status: 'saved' })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return rows.map(toView);
  }
}
