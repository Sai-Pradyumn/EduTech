import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmailOtpDocument = HydratedDocument<EmailOtp>;

/** A one-time email verification code (hashed). One active doc per email; auto-expires via TTL. */
@Schema({ timestamps: true, collection: 'email_otps' })
export class EmailOtp {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email!: string;

  /** bcrypt hash of the 6-digit code — never store the raw code. */
  @Prop({ required: true })
  codeHash!: string;

  @Prop({ default: 'signup' })
  purpose!: string;

  /** TTL index — Mongo removes the doc once this passes. */
  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ type: Date })
  lastSentAt?: Date;
}

export const EmailOtpSchema = SchemaFactory.createForClass(EmailOtp);
// Auto-purge expired codes.
EmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
