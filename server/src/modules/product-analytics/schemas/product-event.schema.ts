import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductEventDocument = HydratedDocument<ProductEvent>;

/** Privacy-respecting product analytics event (Phase 10 · M8). Stores the event name +
 *  lightweight properties only — never learning content or PII beyond ids. */
@Schema({ timestamps: true, collection: 'product_events' })
export class ProductEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  org?: Types.ObjectId;

  @Prop({ required: true, index: true })
  event!: string;

  @Prop({ type: Object, default: {} })
  properties!: Record<string, unknown>;

  @Prop()
  anonymousId?: string;

  @Prop()
  sessionId?: string;
}

export const ProductEventSchema = SchemaFactory.createForClass(ProductEvent);
ProductEventSchema.index({ event: 1, createdAt: -1 });
