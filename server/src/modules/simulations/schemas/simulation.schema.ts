import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Difficulty } from '../../../common/enums';

export const SIMULATION_TYPES = [
  'interview',
  'viva',
  'debugging',
  'system_design',
  'code_walkthrough',
  'product_thinking',
  'mentor_review',
  'group_discussion',
  'client_requirements',
  'teaching_back',
] as const;
export type SimulationType = (typeof SIMULATION_TYPES)[number];

export const SIMULATION_STATUSES = ['active', 'finished'] as const;
export type SimulationStatus = (typeof SIMULATION_STATUSES)[number];

@Schema({ _id: false })
export class RubricCriterion {
  @Prop({ required: true }) criterion!: string;
  @Prop({ default: 1 }) weight!: number;
  /** 0–100 once scored. */
  @Prop({ default: 0 }) score!: number;
}
const RubricCriterionSchema = SchemaFactory.createForClass(RubricCriterion);

@Schema({ _id: false })
export class SimTurn {
  @Prop({ type: String, enum: ['user', 'coach'], required: true })
  role!: 'user' | 'coach';
  @Prop({ required: true }) text!: string;
  @Prop({ type: Date, default: () => new Date() }) at!: Date;
}
const SimTurnSchema = SchemaFactory.createForClass(SimTurn);

export type SimulationDocument = HydratedDocument<Simulation>;

@Schema({ timestamps: true, collection: 'simulations' })
export class Simulation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: SIMULATION_TYPES, default: 'interview' })
  type!: SimulationType;

  @Prop({ required: true }) topic!: string;
  @Prop({ type: String, enum: Difficulty, default: Difficulty.Intermediate })
  difficulty!: Difficulty;
  @Prop({ default: '' }) role!: string;

  @Prop({ default: '' }) scenario!: string;
  @Prop({ type: [RubricCriterionSchema], default: [] }) rubric!: RubricCriterion[];
  @Prop({ type: [SimTurnSchema], default: [] }) transcript!: SimTurn[];

  @Prop({ default: 0, min: 0, max: 100 }) score!: number;
  @Prop({ default: '' }) feedback!: string;
  @Prop({ type: [String], default: [] }) improvementPlan!: string[];

  @Prop({ type: [String], default: [] }) linkedSkills!: string[];
  @Prop({ type: [String], default: [] }) linkedMistakeIds!: string[];
  @Prop() linkedFlowId?: string;

  @Prop({ type: String, enum: SIMULATION_STATUSES, default: 'active' })
  status!: SimulationStatus;
}

export const SimulationSchema = SchemaFactory.createForClass(Simulation);
SimulationSchema.index({ user: 1, createdAt: -1 });
