import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EntitlementUsageDocument = HydratedDocument<EntitlementUsage>;

export type OwnerType = 'user' | 'org';

/**
 * One metered counter per (owner, featureKey, period). Incremented by EntitlementsService
 * .consume() and read by the billing usage meter + the entitlement gate. Counters reset
 * when `resetAt` passes (a fresh row is created for the new period).
 */
@Schema({ timestamps: true, collection: 'entitlement_usage' })
export class EntitlementUsage {
  @Prop({ required: true, enum: ['user', 'org'], index: true })
  ownerType!: OwnerType;

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ required: true, index: true })
  featureKey!: string;

  @Prop({ type: Date, required: true })
  periodStart!: Date;

  @Prop({ type: Date, required: true })
  periodEnd!: Date;

  @Prop({ default: 0 })
  used!: number;

  /** Snapshot of the plan limit at counter creation (-1 = unlimited, 0 = blocked). */
  @Prop({ default: 0 })
  limit!: number;

  @Prop({ type: Date, required: true })
  resetAt!: Date;
}

export const EntitlementUsageSchema =
  SchemaFactory.createForClass(EntitlementUsage);

EntitlementUsageSchema.index(
  { ownerType: 1, ownerId: 1, featureKey: 1, periodStart: 1 },
  { unique: true },
);
