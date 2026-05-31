import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  constructor(
    @InjectModel(AuditLog.name)
    private readonly logs: Model<AuditLogDocument>,
  ) {}

  async record(input: AuditInput): Promise<void> {
    try {
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
      });
    } catch (err) {
      this.logger.warn(`Failed to record audit log: ${(err as Error).message}`);
    }
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
