import {
  AgentMessageDocument,
  AgentSessionDocument,
} from '../schemas/agent-session.schema';

export interface AgentSessionSummary {
  id: string;
  title: string;
  agentType: string;
  lastMessageAt: string | null;
  pinned: boolean;
}

export interface AgentMessageView {
  id: string;
  role: 'user' | 'assistant';
  agentType?: string;
  content: string;
  visualBlocks: unknown[];
  actions: unknown[];
  sources: unknown[];
  followUpQuestions: string[];
  recommendedNextActions: string[];
  confidence: number;
  createdAt: string;
}

export function toSessionSummary(
  doc: AgentSessionDocument,
): AgentSessionSummary {
  const d = doc as unknown as { updatedAt: Date };
  return {
    id: doc.id as string,
    title: doc.title,
    agentType: doc.agentType,
    lastMessageAt: (doc.lastMessageAt ?? d.updatedAt)?.toISOString() ?? null,
    pinned: doc.pinned ?? false,
  };
}

export function toMessageView(doc: AgentMessageDocument): AgentMessageView {
  const d = doc as unknown as { createdAt: Date };
  return {
    id: doc.id as string,
    role: doc.role,
    agentType: doc.agentType,
    content: doc.content,
    visualBlocks: doc.visualBlocks,
    actions: doc.actions,
    sources: doc.sources,
    followUpQuestions: doc.followUpQuestions,
    recommendedNextActions: doc.recommendedNextActions,
    confidence: doc.confidence,
    createdAt: d.createdAt?.toISOString(),
  };
}
