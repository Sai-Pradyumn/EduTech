import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due';

@Schema({ timestamps: true, collection: 'subscriptions' })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user!: Types.ObjectId;

  @Prop({ default: 'free' })
  planId!: string;

  @Prop({ default: 'active' })
  status!: SubscriptionStatus;

  @Prop({ default: 'mock' })
  provider!: string;

  @Prop({ type: Date, default: () => new Date() })
  startedAt!: Date;

  @Prop({ type: Date })
  currentPeriodEnd?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
