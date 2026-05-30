import { AgentType } from '../../common/enums';

export interface GraphNode {
  key: string;
  label: string;
  agentType: AgentType;
  /** Builds the prompt for this node from the run input. */
  prompt: (input: string) => string;
}

export interface GraphTemplate {
  name: string;
  title: string;
  description: string;
  nodes: GraphNode[];
}

/**
 * Built-in agent-graph templates (Phase 3 · A9). Each node runs an Agent OS agent in sequence,
 * sharing one session so later steps see earlier context (a deterministic LangGraph-lite DAG).
 */
export const GRAPH_TEMPLATES: GraphTemplate[] = [
  {
    name: 'master_topic',
    title: 'Master a topic',
    description: 'Explain → quiz → suggest a practice project for any topic.',
    nodes: [
      { key: 'explain', label: 'Explain the concept', agentType: AgentType.Tutor, prompt: (t) => `Explain ${t} clearly with a concrete example and the key ideas to remember.` },
      { key: 'quiz', label: 'Generate a quiz', agentType: AgentType.Assessment, prompt: (t) => `Create a short quiz to test understanding of ${t}.` },
      { key: 'project', label: 'Suggest a project', agentType: AgentType.ProjectBuilder, prompt: (t) => `Suggest a small hands-on project to practice ${t}.` },
    ],
  },
  {
    name: 'interview_prep',
    title: 'Interview prep',
    description: 'Career readiness → targeted explanation → practice questions.',
    nodes: [
      { key: 'gap', label: 'Assess readiness', agentType: AgentType.Career, prompt: (t) => `Assess my readiness for a ${t} role and name the top gap to close.` },
      { key: 'teach', label: 'Teach the gap', agentType: AgentType.Tutor, prompt: (t) => `Teach the most commonly-tested concept for a ${t} interview.` },
      { key: 'practice', label: 'Practice questions', agentType: AgentType.Assessment, prompt: (t) => `Create practice interview questions for a ${t} role.` },
    ],
  },
];

export function graphByName(name: string): GraphTemplate | undefined {
  return GRAPH_TEMPLATES.find((g) => g.name === name);
}
