import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WebhookEndpointDocument = HydratedDocument<WebhookEndpoint>;
export type WebhookDeliveryDocument = HydratedDocument<WebhookDelivery>;

/** Outbound webhook endpoint (Phase 10 · M11). Signed with `secret` (HMAC) when delivering. */
@Schema({ timestamps: true, collection: 'webhook_endpoints' })
export class WebhookEndpoint {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  org!: Types.ObjectId;

  @Prop({ required: true })
  url!: string;

  @Prop({ type: [String], default: [] })
  events!: string[];

  @Prop({ required: true })
  secret!: string;

  @Prop({ default: true })
  active!: boolean;
}

export const WebhookEndpointSchema =
  SchemaFactory.createForClass(WebhookEndpoint);

/** One delivery attempt of an event to an endpoint (Phase 10 · M11). */
@Schema({ timestamps: true, collection: 'webhook_deliveries' })
export class WebhookDelivery {
  @Prop({
    type: Types.ObjectId,
    ref: 'WebhookEndpoint',
    required: true,
    index: true,
  })
  endpoint!: Types.ObjectId;

  @Prop({ required: true })
  event!: string;

  @Prop({ type: Object, default: {} })
  payload!: Record<string, unknown>;

  @Prop({ default: 'pending' })
  status!: 'pending' | 'success' | 'failed';

  @Prop()
  responseCode?: number;

  @Prop()
  error?: string;

  @Prop({ default: 1 })
  attempts!: number;
}

export const WebhookDeliverySchema =
  SchemaFactory.createForClass(WebhookDelivery);
WebhookDeliverySchema.index({ endpoint: 1, createdAt: -1 });
