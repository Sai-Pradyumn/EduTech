import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentMemoryService } from '../agents/core/agent-memory.service';
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

/** One row of "what Asta knows about me", across both memory stores. */
export interface MemoryEntry {
  id: string;
  /** confirmed = learner-approved fact; observed = noted from activity by agents. */
  source: 'confirmed' | 'observed';
  kind: string;
  text: string;
  when: string | null;
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
    private readonly agentMemory: AgentMemoryService,
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

  // ───────────── memory manager: everything Asta knows, deletable ─────────────

  /** Both stores in one list: confirmed facts + what agents noted from activity. */
  async listAll(userId: string): Promise<MemoryEntry[]> {
    const [confirmed, observed] = await Promise.all([
      this.list(userId),
      this.agentMemory.listRaw(userId),
    ]);
    return [
      ...confirmed.map((m) => ({
        id: m.id,
        source: 'confirmed' as const,
        kind: m.type,
        text: m.summary || m.value,
        when: m.createdAt,
      })),
      ...observed.map((m) => ({
        id: m.id,
        source: 'observed' as const,
        kind: m.kind,
        text: m.content,
        when: m.updatedAt?.toISOString() ?? null,
      })),
    ];
  }

  /** Delete a confirmed memory (ownership-checked, audited). */
  async removeConfirmed(
    userId: string,
    email: string,
    id: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Memory not found');
    const m = await this.memories.findOne({
      _id: id,
      user: new Types.ObjectId(userId),
    });
    if (!m) throw new NotFoundException('Memory not found');
    await m.deleteOne();
    await this.audit.record({
      actorId: userId,
      actorEmail: email,
      action: 'memory.delete',
      targetType: 'learner_memory',
      metadata: { value: m.value },
    });
  }

  /** Delete an observed (agent) memory (ownership enforced by the delete filter). */
  async removeObserved(
    userId: string,
    email: string,
    id: string,
  ): Promise<void> {
    await this.agentMemory.forget(userId, id);
    await this.audit.record({
      actorId: userId,
      actorEmail: email,
      action: 'memory.delete',
      targetType: 'agent_memory',
      metadata: { id },
    });
  }

  /**
   * "Remember that …" from chat: saved as a confirmed fact AND mirrored into the
   * agent store (high weight) so it genuinely shapes answers from the next turn.
   */
  async rememberFact(
    userId: string,
    email: string,
    text: string,
  ): Promise<LearnerMemoryView | null> {
    const saved = await this.confirm(userId, email, {
      type: 'fact',
      value: text,
      summary: text,
      decision: 'save',
    });
    await this.agentMemory.remember(userId, 'fact', text, 3, 'chat');
    return saved;
  }

  /**
   * "Forget …" from chat: delete the single best lexical match across BOTH
   * stores. Returns what was deleted (verbatim) or null when nothing matched —
   * the caller must confirm honestly either way.
   */
  async forgetMatching(
    userId: string,
    email: string,
    query: string,
  ): Promise<string | null> {
    const terms = this.tokens(query);
    if (terms.length === 0) return null;
    const all = await this.listAll(userId);
    let best: { entry: MemoryEntry; score: number } | null = null;
    for (const entry of all) {
      const hay = new Set(this.tokens(entry.text));
      let score = 0;
      for (const t of terms) if (hay.has(t)) score++;
      if (score > 0 && (!best || score > best.score)) best = { entry, score };
    }
    if (!best) return null;
    if (best.entry.source === 'confirmed') {
      await this.removeConfirmed(userId, email, best.entry.id);
    } else {
      await this.removeObserved(userId, email, best.entry.id);
    }
    return best.entry.text;
  }

  private tokens(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length > 2 && !['the', 'and', 'that', 'about'].includes(t),
    );
  }
}
