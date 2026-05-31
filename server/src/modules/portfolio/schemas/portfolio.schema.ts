import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const PORTFOLIO_STATUS = ['draft', 'published'] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUS)[number];

@Schema({ _id: false })
export class PortfolioProject {
  @Prop({ required: true }) projectId!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) caseStudy!: string;
  @Prop({ type: [String], default: [] }) stack!: string[];
  @Prop({ type: [String], default: [] }) highlights!: string[];
  @Prop() githubUrl?: string;
  @Prop() demoUrl?: string;
  @Prop({ default: true }) visible!: boolean;
}
const PortfolioProjectSchema = SchemaFactory.createForClass(PortfolioProject);

@Schema({ _id: false })
export class PortfolioLink {
  @Prop({ required: true }) label!: string;
  @Prop({ required: true }) url!: string;
}
const PortfolioLinkSchema = SchemaFactory.createForClass(PortfolioLink);

@Schema({ _id: false })
export class PortfolioPublicSettings {
  @Prop({ default: true }) showProjects!: boolean;
  @Prop({ default: true }) showCertificates!: boolean;
  @Prop({ default: true }) showTimeline!: boolean;
  @Prop({ default: true }) showContact!: boolean;
}
const PortfolioPublicSettingsSchema = SchemaFactory.createForClass(PortfolioPublicSettings);

export type PortfolioDocument = HydratedDocument<Portfolio>;

/**
 * Phase 9 · Portfolio — a public-facing portfolio generated from real learning evidence
 * (Skill Passport + projects + certificates). Editable sections + AI-generated copy; reuses the
 * Skill Passport username so the public link is /p/:username.
 */
@Schema({ timestamps: true, collection: 'portfolios' })
export class Portfolio {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  username!: string;

  @Prop({ default: '' }) title!: string;
  @Prop({ default: '' }) tagline!: string;
  @Prop({ default: '' }) about!: string;
  @Prop({ default: '' }) targetRole!: string;
  @Prop({ type: [String], default: [] }) skills!: string[];
  @Prop({ type: [PortfolioProjectSchema], default: [] }) projects!: PortfolioProject[];
  @Prop({ type: [PortfolioLinkSchema], default: [] }) links!: PortfolioLink[];
  @Prop({ default: 'noir' }) theme!: string;

  @Prop({ type: String, enum: PORTFOLIO_STATUS, default: 'draft', index: true })
  status!: PortfolioStatus;

  @Prop({ type: PortfolioPublicSettingsSchema, default: () => ({}) })
  publicSettings!: PortfolioPublicSettings;

  @Prop() generatedAt?: Date;
  @Prop() publishedAt?: Date;
}

export const PortfolioSchema = SchemaFactory.createForClass(Portfolio);
