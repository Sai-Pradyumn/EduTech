import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MentorProfileDocument = HydratedDocument<MentorProfile>;

/** Phase 9 · Mentor Marketplace — a mentor's public profile students can browse and request. */
@Schema({ timestamps: true, collection: 'mentor_profiles' })
export class MentorProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  @Prop({ default: '' }) headline!: string;
  @Prop({ type: [String], default: [] }) expertise!: string[];
  @Prop({ default: '' }) bio!: string;
  @Prop({ default: 'Flexible — request a slot' }) availability!: string;

  @Prop({ type: String, enum: ['free', 'paid'], default: 'free' })
  pricingMode!: 'free' | 'paid';
  @Prop({ default: '' }) priceNote!: string;

  /** public = anyone; org = only same-org students. */
  @Prop({
    type: String,
    enum: ['public', 'org'],
    default: 'public',
    index: true,
  })
  visibility!: 'public' | 'org';

  /** The mentor's org (from their profile) — required to enforce `org` visibility. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organization?: Types.ObjectId;

  @Prop({
    type: { avg: Number, count: Number },
    default: () => ({ avg: 0, count: 0 }),
  })
  ratingSummary!: { avg: number; count: number };
}

export const MentorProfileSchema = SchemaFactory.createForClass(MentorProfile);
