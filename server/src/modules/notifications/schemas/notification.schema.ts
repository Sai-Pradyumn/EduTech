import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

/**
 * In-app notification (Phase 4 · B13). In-app channel is real; email/WhatsApp/push
 * channels + BullMQ fan-out layer in later. `type` is a free string (roadmap, quiz,
 * review, cohort, certificate, limit, announcement, …).
 */
@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ default: 'info' })
  type!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  body!: string;

  @Prop({ default: '' })
  link!: string;

  @Prop({ default: false })
  read!: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
