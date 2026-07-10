import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/** Immutable record of a security-relevant action (Phase 10 · M6). Org-scoped where the
 *  action belongs to an organization; platform actions carry no org. */
@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ index: true })
  actorId?: string;

  @Prop()
  actorEmail?: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  org?: Types.ObjectId;

  @Prop({ required: true, index: true })
  action!: string;

  @Prop()
  targetType?: string;

  @Prop()
  targetId?: string;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  /* ── Tamper-evident hash chain (SECURITY_IMPLEMENTATION.md §15 · P2) ───────────────
   * entryHash = SHA-256(prevHash | canonical(payload) | chainedAt). Editing or deleting
   * any historical row breaks every later link; AuditService.verifyChain() detects it. */

  @Prop()
  prevHash?: string;

  @Prop({ index: true })
  entryHash?: string;

  /** The exact ISO timestamp folded into the hash (createdAt could be re-serialized). */
  @Prop()
  chainedAt?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
