import { AgentAction, AgentType, GuardianVerdict, SourceReference, VisualBlock } from '../../core/models';

/** How the learner is interacting with Asta in the current session. */
export type AstaSessionMode = 'chat' | 'voice' | 'face';

/** The emotional/working state the central orb reflects. */
export type AstaOrbState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'agents-running'
  | 'success'
  | 'warning'
  | 'error';

export type AstaOrbSize = 'sm' | 'md' | 'lg' | 'hero';

/** A single turn in the Asta OS session thread. */
export interface AstaTurn {
  readonly role: 'user' | 'asta';
  content: string;
  blocks: VisualBlock[];
  actions: AgentAction[];
  followUps: string[];
  recommended: string[];
  sources: SourceReference[];
  agentType?: AgentType;
  /** Detected intent for the run (e.g. `explain`, `quiz`) — shown subtly as Asta's understanding. */
  intent?: string;
  /** Model confidence 0–1 from the synthesized response. */
  confidence?: number;
  /** The learning mode this turn ran under (for honest "guiding" badges). */
  learningMode?: AstaLearningMode;
  streaming: boolean;
  failed: boolean;
  /** Feedback already submitted for this turn, if any. */
  feedback?: 'up' | 'down';
  /** Deep Cognitive Guardian verdict, once the learner asks Asta to double-check. */
  guardian?: GuardianVerdict;
  verifying?: boolean;
  messageId?: string;
}

/** A friendly, user-facing line in the agent-activity stream (never a raw log). */
export interface AstaActivityRow {
  readonly id: number;
  /** `active` = in progress (•), `done` = completed (✓). */
  status: 'active' | 'done';
  label: string;
}

/** Static descriptor for a session-mode segment. */
export interface AstaSessionModeMeta {
  readonly mode: AstaSessionMode;
  readonly label: string;
  /** Inline SVG path data (24×24 viewBox), Lucide-style. */
  readonly icon: string;
}

/** A one-tap suggestion shown under the composer. */
export interface AstaQuickChip {
  readonly label: string;
  /** The message sent to Asta when tapped. */
  readonly prompt: string;
}

/** How Asta teaches this session — maps to a backend TutorMode (drives hint-first/Socratic). */
export type AstaLearningMode = 'balanced' | 'socratic' | 'hint' | 'exam' | 'interview' | 'debug';

/** Static descriptor for a learning mode (label + the TutorMode string sent to the agent). */
export interface AstaLearningModeMeta {
  readonly mode: AstaLearningMode;
  readonly label: string;
  /** Backend TutorMode value passed as `mode` to AgentService.stream. */
  readonly tutorMode: string;
  /** Whether this mode makes Asta guide hint-first instead of answering directly. */
  readonly guiding: boolean;
}

/** A small Cognitive-Guardian trust badge shown on a completed turn. */
export interface AstaTrustBadge {
  readonly id: string;
  readonly label: string;
  readonly tone: 'neutral' | 'grounded' | 'practice' | 'weak' | 'roadmap' | 'guiding';
}
