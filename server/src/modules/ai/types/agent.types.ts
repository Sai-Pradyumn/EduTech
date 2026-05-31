import { AgentType, Intent, Role } from '../../../common/enums';

/** Normalized request every agent receives via the orchestrator. */
export interface AgentRequest {
  userId: string;
  role: Role;
  message: string;
  intent?: Intent;
  /** Force a specific agent (e.g. Mentor Room); otherwise routed by intent. */
  agentType?: AgentType;
  sessionId?: string;
  source?:
    | 'chat'
    | 'dashboard'
    | 'roadmap'
    | 'voice'
    | 'quiz'
    | 'project'
    | 'admin';
  /** Free-form, agent-specific context (e.g. tutor mode, documentIds). */
  context?: Record<string, unknown>;
}

/** A UI action the client can render as a button/CTA. */
export interface AgentAction {
  id: string;
  label: string;
  /** Where the action routes or what it triggers. */
  kind:
    | 'generate_quiz'
    | 'explain_visually'
    | 'simpler'
    | 'ask_interviewer'
    | 'generate_notes'
    | 'open_route'
    | 'practice'
    | 'regenerate'
    | 'custom';
  payload?: Record<string, unknown>;
}

export interface SourceReference {
  documentId: string;
  chunkId?: string;
  title: string;
  snippet: string;
  score?: number;
}

/* ───────────────────────── Visual blocks ─────────────────────────
 * Agents return UI-renderable data, not just prose. The frontend maps
 * each block `type` to a dedicated visual component. */

export interface ConceptMapBlock {
  type: 'concept_map';
  title: string;
  rootConcept: string;
  nodes: { id: string; label: string; group?: string }[];
  edges: { from: string; to: string; label?: string }[];
}

export interface SkillGapBlock {
  type: 'skill_gap';
  title: string;
  skills: { skill: string; current: number; target: number }[]; // 0–100
}

export interface WeaknessAnalysisBlock {
  type: 'weakness_analysis';
  title: string;
  weaknesses: { topic: string; severity: number; note?: string }[]; // severity 0–100
}

export interface QuizBlock {
  type: 'quiz';
  title: string;
  questions: {
    prompt: string;
    options?: string[];
    answerIndex?: number;
    explanation?: string;
  }[];
}

export interface StudyPlanBlock {
  type: 'study_plan';
  title: string;
  items: { label: string; minutes?: number; kind?: string }[];
}

export interface RoadmapTimelineBlock {
  type: 'roadmap_timeline';
  title: string;
  weeks: {
    weekNumber: number;
    focus: string;
    status: 'done' | 'current' | 'todo';
  }[];
}

export interface ProjectPlanBlock {
  type: 'project_plan';
  title: string;
  techStack: string[];
  features: string[];
  tasks: { title: string; done?: boolean }[];
}

export interface MentorFeedbackBlock {
  type: 'mentor_feedback';
  title: string;
  learningHealthScore: number; // 0–100
  highlights: string[];
  risks: string[];
  actionPlan: string[];
}

export interface AdminInsightBlock {
  type: 'admin_insight';
  title: string;
  metrics: { label: string; value: string | number; hint?: string }[];
  notes: string[];
}

export interface PracticeBlock {
  type: 'practice';
  title: string;
  prompt: string;
  hint?: string;
  solutionOutline?: string;
}

export type VisualBlock =
  | ConceptMapBlock
  | SkillGapBlock
  | WeaknessAnalysisBlock
  | QuizBlock
  | StudyPlanBlock
  | RoadmapTimelineBlock
  | ProjectPlanBlock
  | MentorFeedbackBlock
  | AdminInsightBlock
  | PracticeBlock;

export type VisualBlockType = VisualBlock['type'];

/** A proactive "what to do next" the system decides on the learner's behalf. */
export interface NextAction {
  label: string;
  reason: string;
  /** Client route to open (e.g. /app/quizzes). */
  route?: string;
  /** Agent to invoke if the action is a follow-up prompt. */
  agentType?: AgentType;
  /** Prefilled prompt for the follow-up. */
  prompt?: string;
  kind:
    | 'revise'
    | 'roadmap'
    | 'quiz'
    | 'project'
    | 'career'
    | 'explore'
    | 'session';
}

/** One step in an orchestration plan (usually a single step). */
export interface PlanStep {
  agentType: AgentType;
  goal: string;
}

/** Normalized response every agent returns. */
export interface AgentResponse {
  agentType: AgentType;
  intent: Intent;
  mode: 'text' | 'structured' | 'visual' | 'voice' | 'mixed';
  answer: string; // markdown
  actions: AgentAction[];
  visualBlocks: VisualBlock[];
  sources?: SourceReference[];
  confidence: number; // 0–1
  followUpQuestions: string[];
  recommendedNextActions: string[];
  /** Proactive next move chosen from the learner's state (orchestrator-attached). */
  nextAction?: NextAction;
}

/* ───────────────────── Streaming workflow events ───────────────────── */

export type AgentStreamEvent =
  | {
      type: 'started';
      sessionId: string;
      messageId: string;
      agentType: AgentType;
    }
  | { type: 'plan'; messageId: string; steps: PlanStep[]; rationale: string }
  | {
      type: 'step_started';
      messageId: string;
      index: number;
      agentType: AgentType;
      goal: string;
    }
  | {
      type: 'step_completed';
      messageId: string;
      index: number;
      agentType: AgentType;
    }
  | { type: 'thinking'; messageId: string; label: string }
  | { type: 'tool_call'; messageId: string; tool: string; label: string }
  | { type: 'tool_result'; messageId: string; tool: string; summary: string }
  | { type: 'chunk'; messageId: string; delta: string }
  | { type: 'visual_block'; messageId: string; block: VisualBlock }
  | { type: 'completed'; messageId: string; response: AgentResponse }
  | { type: 'error'; messageId: string; message: string };

/** Hook agents use to stream events; no-op when not streaming. */
export type StreamEmit = (event: AgentStreamEvent) => void;
