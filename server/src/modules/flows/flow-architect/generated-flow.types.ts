import { Difficulty } from '../../../common/enums';
import {
  FlowEdgeRelation,
  FlowNodeStatus,
  FlowNodeType,
  FlowSourceType,
} from '../schemas/flow.schema';

/** The structured shape the FlowArchitect produces (LLM or deterministic fallback). */
export interface GeneratedFlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  summary: string;
  objective: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  status: FlowNodeStatus;
  position: { x: number; y: number };
  stage: number;
  prerequisites: string[];
  resources: { label: string; url?: string; kind?: string }[];
  agentHints: string[];
}

export interface GeneratedFlowEdge {
  id: string;
  source: string;
  target: string;
  relation: FlowEdgeRelation;
  strength: number;
  explanation: string;
}

export interface GeneratedFlowTimelineBucket {
  index: number;
  label: string;
  focus: string;
  nodeIds: string[];
}

export interface GeneratedFlow {
  title: string;
  goal: string;
  description: string;
  difficulty: Difficulty;
  sourceType: FlowSourceType;
  nodes: GeneratedFlowNode[];
  edges: GeneratedFlowEdge[];
  timeline: GeneratedFlowTimelineBucket[];
  metadata: Record<string, unknown>;
}

/** Inputs the architect uses to shape the graph. */
export interface FlowBlueprintInput {
  goal: string;
  skillLevel: Difficulty;
  currentSkills: string[];
  weakAreas: string[];
  targetRole?: string;
  preferredStack?: string[];
  dailyMinutes?: number;
  timelineWeeks?: number;
  learningStyle?: string;
  sourceType?: FlowSourceType;
  sourceId?: string;
  /** Optional roadmap weeks to seed the graph from (when generating from a roadmap). */
  roadmapWeeks?: { weekNumber: number; focus: string; topics: string[] }[];
  roadmapTitle?: string;
}
