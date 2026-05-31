import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CouncilRecommendationDocument =
  HydratedDocument<CouncilRecommendation>;

/** Phase 9 · Caches the latest AI Outcome Council verdict for a learner. */
@Schema({ timestamps: true, collection: 'council_recommendations' })
export class CouncilRecommendation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ default: '' }) verdict!: string;
  /** The single best next action + ranked alternatives (denormalised view objects). */
  @Prop({ type: Object }) best?: Record<string, unknown>;
  @Prop({ type: [Object], default: [] }) alternatives!: Record<
    string,
    unknown
  >[];
  @Prop({ type: Object }) context?: Record<string, unknown>;
}

export const CouncilRecommendationSchema = SchemaFactory.createForClass(
  CouncilRecommendation,
);
CouncilRecommendationSchema.index({ user: 1, createdAt: -1 });
