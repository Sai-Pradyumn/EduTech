import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MentorProfileDocument = HydratedDocument<MentorProfile>;

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

  @Prop({ default: '' })
  headline!: string;

  @Prop({ default: '' })
  bio!: string;

  @Prop({ type: [String], default: [] })
  skills!: string[];

  @Prop({ type: [String], default: [] })
  languages!: string[];

  @Prop({ default: 0 })
  experienceYears!: number;

  /** Free-form availability (e.g. "Weeknights 7–9pm IST"). Slot booking lands with B4. */
  @Prop({ default: '' })
  availability!: string;

  /** Pricing + ratings are placeholders until the marketplace phase. */
  @Prop({ default: 0 })
  hourlyRate!: number;

  @Prop({ default: 0 })
  rating!: number;
}

export const MentorProfileSchema = SchemaFactory.createForClass(MentorProfile);
