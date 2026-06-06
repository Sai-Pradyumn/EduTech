import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const DAILY_PLAN_MODES = [
  'normal',
  'quick',
  'exam',
  'burnout_recovery',
] as const;
export type DailyPlanMode = (typeof DAILY_PLAN_MODES)[number];

export const DAILY_ITEM_KINDS = [
  'flow_node',
  'mistake',
  'quiz',
  'revision',
  'project',
] as const;
export type DailyItemKind = (typeof DAILY_ITEM_KINDS)[number];

@Schema({ _id: false })
export class DailyItem {
  @Prop({ required: true }) id!: string;
  @Prop({ type: String, enum: DAILY_ITEM_KINDS, default: 'revision' })
  kind!: DailyItemKind;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) reason!: string;
  @Prop({ default: '/app/dashboard' }) route!: string;
  @Prop({ default: 20 }) estimateMinutes!: number;
  @Prop({ default: false }) done!: boolean;
  @Prop() sourceId?: string;
  /** Optional learner note — a reminder or reflection attached to this item. */
  @Prop({ default: '' }) note?: string;
}
const DailyItemSchema = SchemaFactory.createForClass(DailyItem);

export type DailyPlanDocument = HydratedDocument<DailyPlan>;

@Schema({ timestamps: true, collection: 'daily_plans' })
export class DailyPlan {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** yyyy-mm-dd — one plan per learner per day. */
  @Prop({ required: true }) date!: string;

  @Prop({ type: String, enum: DAILY_PLAN_MODES, default: 'normal' })
  mode!: DailyPlanMode;

  @Prop({ type: [DailyItemSchema], default: [] }) items!: DailyItem[];
  @Prop({ default: 0 }) totalMinutes!: number;

  /** Set once, the first time every item in the plan is complete — guards the
   *  one-per-day `daily_plan_completed` Proof-Ledger event from double-firing. */
  @Prop({ type: Date }) completedLoggedAt?: Date;
}

export const DailyPlanSchema = SchemaFactory.createForClass(DailyPlan);
DailyPlanSchema.index({ user: 1, date: 1 }, { unique: true });
