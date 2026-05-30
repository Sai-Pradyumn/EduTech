import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Educational visual kinds (Phase 8 · Visual Intelligence Studio). */
export const VISUAL_TYPES = [
  'flowchart',
  'mind_map',
  'concept_graph',
  'sequence_diagram',
  'system_design',
  'architecture',
  'comparison',
  'timeline',
  'infographic',
  'flashcard',
  'memory_palace',
  'formula_map',
  'process_map',
  'cheat_sheet',
  'illustration',
  'analogy',
] as const;
export type VisualType = (typeof VISUAL_TYPES)[number];

/** How `content` should be interpreted/rendered. Structured-first; image last. */
export const VISUAL_CONTENT_FORMATS = ['svg', 'mermaid', 'jsonGraph', 'imageUrl', 'markdown', 'html'] as const;
export type VisualContentFormat = (typeof VISUAL_CONTENT_FORMATS)[number];

export const VISUAL_SOURCE_TYPES = ['tutor', 'roadmap', 'flow', 'knowledge', 'quiz', 'project', 'manual'] as const;
export type VisualSourceType = (typeof VISUAL_SOURCE_TYPES)[number];

export const VISUAL_STATUSES = ['generating', 'ready', 'failed'] as const;
export type VisualStatus = (typeof VISUAL_STATUSES)[number];

export type VisualAssetDocument = HydratedDocument<VisualAsset>;

@Schema({ timestamps: true, collection: 'visual_assets' })
export class VisualAsset {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  org?: Types.ObjectId;

  @Prop({ type: String, enum: VISUAL_TYPES, default: 'flowchart' })
  type!: VisualType;

  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) prompt!: string;

  @Prop({ type: String, enum: VISUAL_SOURCE_TYPES, default: 'manual' })
  sourceType!: VisualSourceType;
  @Prop() sourceId?: string;
  /** When sourced from a flow node, the specific node id. */
  @Prop() sourceNodeId?: string;

  @Prop({ type: String, enum: VISUAL_CONTENT_FORMATS, default: 'jsonGraph' })
  contentFormat!: VisualContentFormat;
  /** The renderable payload (SVG markup, mermaid text, JSON graph string, data-URI, markdown). */
  @Prop({ default: '' }) content!: string;
  /** Optional secondary copyable form (e.g. a mermaid string for a jsonGraph visual). */
  @Prop({ default: '' }) mermaid!: string;
  /** Small inline preview (data-URI SVG) for the gallery. */
  @Prop({ default: '' }) thumbnail!: string;

  /** Plain-language caption + "how to read this" guidance the agent produces. */
  @Prop({ default: '' }) caption!: string;
  @Prop({ default: '' }) howToRead!: string;
  /** Learner level this version targets. */
  @Prop({ type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' })
  level!: 'beginner' | 'intermediate' | 'advanced';

  @Prop({ type: String, enum: VISUAL_STATUSES, default: 'ready' })
  status!: VisualStatus;

  @Prop({ default: 'mock' }) provider!: string;

  @Prop({ type: Object, default: {} }) metadata!: Record<string, unknown>;
}

export const VisualAssetSchema = SchemaFactory.createForClass(VisualAsset);
VisualAssetSchema.index({ user: 1, createdAt: -1 });
