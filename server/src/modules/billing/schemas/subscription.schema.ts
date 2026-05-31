import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

@Schema({ timestamps: true, collection: 'subscriptions' })
export class Subscription {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  /** Future org-scoped subscriptions (Phase 10 · M1). */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  org?: Types.ObjectId;

  @Prop({ default: 'free' })
  planId!: string;

  @Prop({ default: 'active' })
  status!: SubscriptionStatus;

  @Prop({ default: 'mock' })
  provider!: string;

  @Prop()
  providerSubscriptionId?: string;

  @Prop({ type: Date, default: () => new Date() })
  startedAt!: Date;

  @Prop({ type: Date })
  currentPeriodStart?: Date;

  @Prop({ type: Date })
  currentPeriodEnd?: Date;

  /** When true, plan reverts to free at currentPeriodEnd. */
  @Prop({ default: false })
  cancelAtPeriodEnd!: boolean;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
