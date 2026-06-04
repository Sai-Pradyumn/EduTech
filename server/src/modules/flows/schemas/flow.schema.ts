import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Difficulty } from '../../../common/enums';

/** Living-graph node kinds (Phase 8 · Flow Studio). */
export const FLOW_NODE_TYPES = [
  'concept',
  'prerequisite',
  'lesson',
  'practice',
  'quiz',
  'project',
  'checkpoint',
  'weak_area_repair',
  'mentor_review',
  'voice_practice',
  'simulation',
  'document_source',
  'diagram',
  'image',
  'mastery_gate',
] as const;
export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number];

/** Dependency relations between nodes. */
export const FLOW_EDGE_RELATIONS = [
  'prerequisite',
  'unlocks',
  'reinforces',
  'tests',
  'depends_on',
  'alternative_path',
  'weak_area_patch',
  'project_application',
] as const;
export type FlowEdgeRelation = (typeof FLOW_EDGE_RELATIONS)[number];

export const FLOW_NODE_STATUSES = [
  'locked',
  'available',
  'in_progress',
  'completed',
  'skipped',
] as const;
export type FlowNodeStatus = (typeof FLOW_NODE_STATUSES)[number];

export const FLOW_STATUSES = [
  'draft',
  'active',
  'completed',
  'archived',
] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

export const FLOW_SOURCE_TYPES = [
  'manual',
  'roadmap',
  'document',
  'quiz',
  'project',
  'voice',
  'generated',
] as const;
export type FlowSourceType = (typeof FLOW_SOURCE_TYPES)[number];

@Schema({ _id: false })
export class FlowNodePosition {
  @Prop({ default: 0 }) x!: number;
  @Prop({ default: 0 }) y!: number;
}
const FlowNodePositionSchema = SchemaFactory.createForClass(FlowNodePosition);

@Schema({ _id: false })
export class FlowNode {
  @Prop({ required: true }) id!: string;
  @Prop({ type: String, enum: FLOW_NODE_TYPES, default: 'concept' })
  type!: FlowNodeType;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) summary!: string;
  @Prop({ default: '' }) objective!: string;
  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  difficulty!: Difficulty;
  @Prop({ default: 30 }) estimatedMinutes!: number;
  /** 0–100 self/quiz-derived mastery for this node's concept. */
  @Prop({ default: 0, min: 0, max: 100 }) masteryScore!: number;
  @Prop({ type: String, enum: FLOW_NODE_STATUSES, default: 'locked' })
  status!: FlowNodeStatus;
  @Prop({ type: FlowNodePositionSchema, default: () => ({ x: 0, y: 0 }) })
  position!: FlowNodePosition;
  /** Which logical column/week this node belongs to (timeline view). */
  @Prop({ default: 0 }) stage!: number;
  /** Node ids that must be completed before this unlocks. */
  @Prop({ type: [String], default: [] }) prerequisites!: string[];
  /** Suggested resources (label + optional url). */
  @Prop({ type: [{ label: String, url: String, kind: String }], default: [] })
  resources!: { label: string; url?: string; kind?: string }[];
  /** Hints the executing agent should use when this node is started. */
  @Prop({ type: [String], default: [] }) agentHints!: string[];
  /** Learner's private journal note for this node ("struggled here", "revisit"). */
  @Prop({ default: '' }) notes!: string;

  // Cross-module links (Phase 8 data relationships).
  @Prop() linkedRoadmapId?: string;
  @Prop() linkedQuizId?: string;
  @Prop() linkedProjectId?: string;
  @Prop({ type: [String], default: [] }) linkedKnowledgeDocumentIds!: string[];
  @Prop({ type: [String], default: [] }) linkedVisualAssetIds!: string[];
  @Prop({ type: [String], default: [] }) linkedVoiceSessionIds!: string[];

  /** For weak_area_repair nodes: the originating concept, so mastering it closes the Mistake OS gap. */
  @Prop() repairConcept?: string;
}
const FlowNodeSchema = SchemaFactory.createForClass(FlowNode);

@Schema({ _id: false })
export class FlowEdge {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) source!: string;
  @Prop({ required: true }) target!: string;
  @Prop({ type: String, enum: FLOW_EDGE_RELATIONS, default: 'unlocks' })
  relation!: FlowEdgeRelation;
  /** 0–1 strength of the dependency (drives edge weight rendering). */
  @Prop({ default: 0.7, min: 0, max: 1 }) strength!: number;
  @Prop({ default: '' }) explanation!: string;
}
const FlowEdgeSchema = SchemaFactory.createForClass(FlowEdge);

/** A timeline bucket (week/day) that groups node ids for the timeline view. */
@Schema({ _id: false })
export class FlowTimelineBucket {
  @Prop({ required: true }) index!: number;
  @Prop({ default: '' }) label!: string;
  @Prop({ default: '' }) focus!: string;
  @Prop({ type: [String], default: [] }) nodeIds!: string[];
}
const FlowTimelineBucketSchema =
  SchemaFactory.createForClass(FlowTimelineBucket);

export type FlowDocument = HydratedDocument<Flow>;

@Schema({ timestamps: true, collection: 'flows' })
export class Flow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  org?: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) goal!: string;
  @Prop({ default: '' }) description!: string;

  @Prop({ type: String, enum: FLOW_SOURCE_TYPES, default: 'generated' })
  sourceType!: FlowSourceType;
  /** Optional id of the source artifact (roadmap/document/quiz/project/voice session). */
  @Prop() sourceId?: string;

  @Prop({ type: String, enum: FLOW_STATUSES, default: 'active' })
  status!: FlowStatus;

  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  difficulty!: Difficulty;

  @Prop({ type: [FlowNodeSchema], default: [] }) nodes!: FlowNode[];
  @Prop({ type: [FlowEdgeSchema], default: [] }) edges!: FlowEdge[];
  @Prop({ type: [FlowTimelineBucketSchema], default: [] })
  timeline!: FlowTimelineBucket[];

  @Prop({ default: 0, min: 0, max: 100 }) progressPercentage!: number;

  /** When the flow first reached 'completed' (time-to-mastery). */
  @Prop() completedAt?: Date;

  /** Free-form metadata (target role, stack, daily minutes, weak areas snapshot). */
  @Prop({ type: Object, default: {} }) metadata!: Record<string, unknown>;
}

export const FlowSchema = SchemaFactory.createForClass(Flow);
FlowSchema.index({ user: 1, createdAt: -1 });
FlowSchema.index({ user: 1, status: 1 });
