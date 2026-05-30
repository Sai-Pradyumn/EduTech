import { AgentType } from '../../../common/enums';
import { AgentRequest, AgentResponse, StreamEmit } from '../../ai/types/agent.types';
import { StudentProfileDocument } from '../../student-profile/schemas/student-profile.schema';

/** Lightweight roadmap context handed to agents (avoids importing the full model). */
export interface RoadmapContext {
  id: string;
  title: string;
  goal: string;
  progressPercentage: number;
  currentWeekFocus?: string;
  totalWeeks: number;
}

export interface MemoryItem {
  kind: string;
  content: string;
}

/** Prior conversation turns (chronological) for multi-turn coherence. */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Runtime context the orchestrator assembles and passes to the selected agent. */
export interface AgentRuntimeContext {
  request: AgentRequest;
  profile: StudentProfileDocument | null;
  roadmap: RoadmapContext | null;
  memories: MemoryItem[];
  /** Recent turns of this session (excludes the current message). */
  history: HistoryTurn[];
  /** Rolling summary of earlier turns (when the chat is long). */
  summary?: string;
  /** Streams workflow/token events to the client; no-op when not streaming. */
  emit: StreamEmit;
}

/** Every agent implements this. Agents are stateless; state lives in context. */
export interface IAgent {
  readonly type: AgentType;
  handle(ctx: AgentRuntimeContext): Promise<AgentResponse>;
}
