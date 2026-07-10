import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChainVerification,
  computeEntryHash,
  GENESIS_HASH,
  verifyChain,
} from '../../common/security/audit-chain';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditInput {
  actorId?: string;
  actorEmail?: string;
  orgId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Audit trail (Phase 10 · M6). @Global service every module can call to record a
 * security-relevant action. record() never throws into the caller — audit failures must
 * not break the underlying action.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /** Serializes chained writes in-process so concurrent record() calls can't fork the
   *  chain by reading the same predecessor. (Multi-instance deployments should route audit
   *  writes through one writer or accept per-instance chains — documented in §15.) */
  private chainTail: Promise<void> = Promise.resolve();

  constructor(
    @InjectModel(AuditLog.name)
    private readonly logs: Model<AuditLogDocument>,
  ) {}

  async record(input: AuditInput): Promise<void> {
    const task = this.chainTail.then(async () => {
      // Hash-chain link (§15 · P2): anchor this entry to the newest existing one.
      const last = await this.logs
        .findOne({ entryHash: { $exists: true } })
        .sort({ createdAt: -1 })
        .select('entryHash')
        .lean<{ entryHash?: string } | null>()
        .exec();
      const prevHash = last?.entryHash ?? GENESIS_HASH;
      const chainedAt = new Date().toISOString();
      const payload = {
        action: input.action,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ?? {},
      };
      await this.logs.create({
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        org: input.orgId ? new Types.ObjectId(input.orgId) : undefined,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ?? {},
        ip: input.ip,
        userAgent: input.userAgent,
        prevHash,
        entryHash: computeEntryHash(prevHash, payload, chainedAt),
        chainedAt,
      });
    });
    // Keep the queue alive even when a link fails; report the failure without throwing.
    this.chainTail = task.catch(() => undefined);
    try {
      await task;
    } catch (err) {
      this.logger.warn(`Failed to record audit log: ${(err as Error).message}`);
    }
  }

  /**
   * Re-walk the chained portion of the log (oldest first) and verify every link — detects
   * retroactive modification or deletion of audit entries (§15 · P2).
   */
  async verifyChain(): Promise<ChainVerification> {
    const rows = await this.logs
      .find({ entryHash: { $exists: true } })
      .sort({ createdAt: 1 })
      .lean<
        Array<{
          action: string;
          actorId?: string;
          actorEmail?: string;
          targetType?: string;
          targetId?: string;
          metadata?: Record<string, unknown>;
          prevHash?: string;
          entryHash?: string;
          chainedAt?: string;
        }>
      >()
      .exec();
    return verifyChain(
      rows.map((r) => ({
        prevHash: r.prevHash ?? GENESIS_HASH,
        entryHash: r.entryHash ?? '',
        timestampIso: r.chainedAt ?? '',
        payload: {
          action: r.action,
          actorId: r.actorId,
          actorEmail: r.actorEmail,
          targetType: r.targetType,
          targetId: r.targetId,
          metadata: r.metadata ?? {},
        },
      })),
    );
  }

  async list(opts: { orgId?: string; limit?: number } = {}) {
    const filter: Record<string, unknown> = {};
    if (opts.orgId) filter.org = new Types.ObjectId(opts.orgId);
    const rows = await this.logs
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(opts.limit ?? 100)
      .lean<AuditLogDocument[]>()
      .exec();
    return rows.map((l) => ({
      id: String(l._id),
      actorId: l.actorId ?? null,
      actorEmail: l.actorEmail ?? null,
      action: l.action,
      targetType: l.targetType ?? null,
      targetId: l.targetId ?? null,
      metadata: l.metadata,
      ip: l.ip ?? null,
      createdAt: (l as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    }));
  }
}
