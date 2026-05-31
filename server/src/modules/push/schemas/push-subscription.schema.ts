import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PushSubscriptionDocument = HydratedDocument<PushSubscription>;

/** Web Push subscription (Phase 10 · M4/M5). Stored per user/device; actual delivery is a
 *  placeholder until a VAPID key + web-push sender are configured. */
@Schema({ timestamps: true, collection: 'push_subscriptions' })
export class PushSubscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  endpoint!: string;

  @Prop({ type: Object, default: {} })
  keys!: Record<string, string>;

  @Prop()
  userAgent?: string;
}

export const PushSubscriptionSchema =
  SchemaFactory.createForClass(PushSubscription);
