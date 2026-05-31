import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FeatureFlagDocument = HydratedDocument<FeatureFlag>;

/** Persisted override of a catalog flag. Absence of a row = catalog default. */
@Schema({ timestamps: true, collection: 'feature_flags' })
export class FeatureFlag {
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ default: true })
  enabled!: boolean;

  /** 'global' | 'plan' | 'org' — kept simple; plan/org scoping read from allowedPlans. */
  @Prop({ default: 'global' })
  scope!: string;

  @Prop({ type: [String], default: [] })
  allowedPlans!: string[];

  @Prop({ type: [String], default: [] })
  allowedOrgs!: string[];

  @Prop({ default: 100 })
  rolloutPercent!: number;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop()
  updatedBy?: string;
}

export const FeatureFlagSchema = SchemaFactory.createForClass(FeatureFlag);
