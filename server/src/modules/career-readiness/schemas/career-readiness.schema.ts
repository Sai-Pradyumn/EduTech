import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CareerReadinessStateDocument =
  HydratedDocument<CareerReadinessState>;

/** Phase 9 · Persists the learner's chosen target role + a cached score. Analysis is computed live. */
@Schema({ timestamps: true, collection: 'career_readiness_states' })
export class CareerReadinessState {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  /** Role id from the static catalog (career-roles.ts). */
  @Prop({ required: true, default: 'full-stack-developer' })
  targetRoleId!: string;

  @Prop({ default: 0 }) lastScore!: number;
  @Prop() lastAnalyzedAt?: Date;
}

export const CareerReadinessStateSchema =
  SchemaFactory.createForClass(CareerReadinessState);
