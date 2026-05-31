import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiBudgetPolicyDocument = HydratedDocument<AiBudgetPolicy>;

/** AI spend/governance policy (Phase 10 · M2). Scoped to a user, org or plan. Read by the
 *  AI request guard to cap usage and restrict providers/models/strategies. */
@Schema({ timestamps: true, collection: 'ai_budget_policies' })
export class AiBudgetPolicy {
  @Prop({ required: true, enum: ['user', 'org', 'plan'], index: true })
  ownerType!: 'user' | 'org' | 'plan';

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ default: -1 })
  monthlyTokenLimit!: number;

  @Prop({ default: -1 })
  monthlyCostLimit!: number;

  @Prop({ default: -1 })
  perRequestTokenLimit!: number;

  @Prop({ type: [String], default: [] })
  allowedProviders!: string[];

  @Prop({ type: [String], default: [] })
  allowedModels!: string[];

  @Prop({ default: true })
  allowParallel!: boolean;

  @Prop({ default: true })
  allowRefine!: boolean;

  @Prop({ default: false })
  allowImageGeneration!: boolean;

  @Prop({ default: true })
  allowVoiceGeneration!: boolean;
}

export const AiBudgetPolicySchema =
  SchemaFactory.createForClass(AiBudgetPolicy);
AiBudgetPolicySchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });
