import { AgentType } from '../models';

/** Agent color/glyph key — DESIGN_SPEC §2.1. Used by chat avatars, cards, roadmap nodes. */
export type AgentAccent = 'green' | 'coral' | 'peri';

export interface AgentMeta {
  type: AgentType;
  id: string; // mono label e.g. "roadmap.agent"
  title: string;
  description: string;
  accent: AgentAccent;
}

export const AGENTS: Record<AgentType, AgentMeta> = {
  roadmap: {
    type: 'roadmap',
    id: 'roadmap.agent',
    title: 'Roadmap',
    description: 'Turns your goal into a week-by-week path.',
    accent: 'green',
  },
  tutor: {
    type: 'tutor',
    id: 'tutor.agent',
    title: 'Tutor',
    description: 'Teaches concepts in the mode that fits you.',
    accent: 'peri',
  },
  mentor: {
    type: 'mentor',
    id: 'mentor.agent',
    title: 'Mentor',
    description: 'Reviews progress and plans your week.',
    accent: 'green',
  },
  voice: {
    type: 'voice',
    id: 'voice.agent',
    title: 'Voice',
    description: 'Spoken practice, interviews and revision.',
    accent: 'peri',
  },
  content_creator: {
    type: 'content_creator',
    id: 'content.agent',
    title: 'Content',
    description: 'Generates lessons, notes and flashcards.',
    accent: 'coral',
  },
  doubt_solver: {
    type: 'doubt_solver',
    id: 'doubt.agent',
    title: 'Doubt Solver',
    description: 'Untangles a specific doubt, step by step.',
    accent: 'coral',
  },
  rag: {
    type: 'rag',
    id: 'rag.search',
    title: 'Knowledge',
    description: 'Answers from your trusted documents.',
    accent: 'peri',
  },
  assessment: {
    type: 'assessment',
    id: 'assess.agent',
    title: 'Assessment',
    description: 'Builds and grades quizzes on weak areas.',
    accent: 'green',
  },
  project_builder: {
    type: 'project_builder',
    id: 'project.agent',
    title: 'Project Builder',
    description: 'Designs a full project blueprint.',
    accent: 'coral',
  },
  career: {
    type: 'career',
    id: 'career.agent',
    title: 'Career',
    description: 'Career guidance (coming soon).',
    accent: 'green',
  },
  admin_insight: {
    type: 'admin_insight',
    id: 'insight.agent',
    title: 'Admin Insight',
    description: 'Summarizes platform AI usage.',
    accent: 'peri',
  },
};

export const ACCENT_VAR: Record<AgentAccent, string> = {
  green: 'var(--green)',
  coral: 'var(--coral)',
  peri: 'var(--peri)',
};
export const ACCENT_DEEP_VAR: Record<AgentAccent, string> = {
  green: 'var(--green-deep)',
  coral: 'var(--coral-deep)',
  peri: 'var(--peri-deep)',
};
