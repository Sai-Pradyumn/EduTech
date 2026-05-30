/** Frontend mirror of the server Agent OS contract (ai/types/agent.types.ts). */

export type AgentType =
  | 'roadmap' | 'tutor' | 'mentor' | 'doubt_solver' | 'rag' | 'assessment'
  | 'project_builder' | 'career' | 'voice' | 'content_creator' | 'admin_insight';

export interface AgentAction {
  id: string;
  label: string;
  kind: string;
  payload?: Record<string, unknown>;
}

export interface SourceReference {
  documentId: string;
  chunkId?: string;
  title: string;
  snippet: string;
  score?: number;
}

/* Visual blocks — discriminated by `type`. */
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
  skills: { skill: string; current: number; target: number }[];
}
export interface WeaknessAnalysisBlock {
  type: 'weakness_analysis';
  title: string;
  weaknesses: { topic: string; severity: number; note?: string }[];
}
export interface QuizBlock {
  type: 'quiz';
  title: string;
  questions: { prompt: string; options?: string[]; answerIndex?: number; explanation?: string }[];
}
export interface StudyPlanBlock {
  type: 'study_plan';
  title: string;
  items: { label: string; minutes?: number; kind?: string }[];
}
export interface RoadmapTimelineBlock {
  type: 'roadmap_timeline';
  title: string;
  weeks: { weekNumber: number; focus: string; status: 'done' | 'current' | 'todo' }[];
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
  learningHealthScore: number;
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
  | ConceptMapBlock | SkillGapBlock | WeaknessAnalysisBlock | QuizBlock | StudyPlanBlock
  | RoadmapTimelineBlock | ProjectPlanBlock | MentorFeedbackBlock | AdminInsightBlock | PracticeBlock;

export interface AgentResponse {
  agentType: AgentType;
  intent: string;
  mode: 'text' | 'structured' | 'visual' | 'voice' | 'mixed';
  answer: string;
  actions: AgentAction[];
  visualBlocks: VisualBlock[];
  sources?: SourceReference[];
  confidence: number;
  followUpQuestions: string[];
  recommendedNextActions: string[];
}

export type AgentStreamEvent =
  | { type: 'started'; sessionId: string; messageId: string; agentType: AgentType }
  | { type: 'thinking'; messageId: string; label: string }
  | { type: 'tool_call'; messageId: string; tool: string; label: string }
  | { type: 'tool_result'; messageId: string; tool: string; summary: string }
  | { type: 'chunk'; messageId: string; delta: string }
  | { type: 'visual_block'; messageId: string; block: VisualBlock }
  | { type: 'completed'; messageId: string; response: AgentResponse }
  | { type: 'error'; messageId: string; message: string };

export interface AgentSessionSummary {
  id: string;
  title: string;
  agentType: AgentType;
  lastMessageAt: string | null;
}

export interface AgentMessageView {
  id: string;
  role: 'user' | 'assistant';
  agentType?: AgentType;
  content: string;
  visualBlocks: VisualBlock[];
  actions: AgentAction[];
  sources: SourceReference[];
  followUpQuestions: string[];
  recommendedNextActions: string[];
  confidence: number;
  createdAt: string;
}

/** A workflow step shown in the live activity feed. */
export interface WorkflowStepView {
  kind: 'thinking' | 'tool_call' | 'tool_result' | 'done';
  label: string;
}
