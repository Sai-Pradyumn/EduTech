import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

/** Login session / device record (Phase 10 · M6). Lets a user see where they're signed in
 *  and revoke devices. Coexists with the single refresh-token model — revoking the current
 *  device clears the user's refresh token. */
@Schema({ timestamps: true, collection: 'sessions' })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop()
  device?: string;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: Date, default: () => new Date() })
  lastSeenAt!: Date;

  @Prop({ type: Date })
  revokedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ user: 1, revokedAt: 1 });
