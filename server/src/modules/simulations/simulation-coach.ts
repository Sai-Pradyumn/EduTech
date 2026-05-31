import { AgentType } from '../../common/enums';
import { SimulationType } from './schemas/simulation.schema';

interface SimBlueprint {
  agent: AgentType;
  role: string;
  rubric: string[];
  scenario: (topic: string) => string;
  /** Frames each learner response into the coach's next prompt. */
  frame: (topic: string, msg: string) => string;
}

export const SIM_BLUEPRINTS: Record<SimulationType, SimBlueprint> = {
  interview: {
    agent: AgentType.Career,
    role: 'Technical interviewer',
    rubric: ['Correctness', 'Communication', 'Problem-solving approach', 'Depth'],
    scenario: (t) => `Mock interview on ${t}. I'll ask focused questions — answer as you would in a real interview. First question: walk me through your understanding of ${t}.`,
    frame: (t, m) => `Interview on ${t}. The candidate answered: "${m}". Give one short line of feedback, then ask the next harder question.`,
  },
  viva: {
    agent: AgentType.Tutor,
    role: 'Examiner',
    rubric: ['Conceptual clarity', 'Accuracy', 'Examples'],
    scenario: (t) => `Oral viva on ${t}. Explain the core idea of ${t} in your own words to begin.`,
    frame: (t, m) => `Viva on ${t}. The student said: "${m}". Briefly judge it, then ask the next viva question.`,
  },
  debugging: {
    agent: AgentType.DoubtSolver,
    role: 'Pairing partner',
    rubric: ['Diagnosis', 'Hypothesis testing', 'Fix quality'],
    scenario: (t) => `Debugging challenge on ${t}. Here's a buggy scenario: something in ${t} is failing intermittently. How would you start diagnosing it?`,
    frame: (t, m) => `Debugging ${t}. The learner said: "${m}". React as a pairing partner and pose the next debugging step.`,
  },
  system_design: {
    agent: AgentType.Career,
    role: 'Design interviewer',
    rubric: ['Requirements', 'High-level design', 'Scalability', 'Trade-offs'],
    scenario: (t) => `System design round: design ${t}. Start by clarifying the requirements and scale you're assuming.`,
    frame: (t, m) => `System design of ${t}. Candidate said: "${m}". Probe one trade-off, then ask the next design question.`,
  },
  code_walkthrough: {
    agent: AgentType.Tutor,
    role: 'Reviewer',
    rubric: ['Clarity', 'Correctness', 'Edge cases'],
    scenario: (t) => `Code walkthrough on ${t}. Walk me through how your solution for ${t} works, step by step.`,
    frame: (t, m) => `Walkthrough of ${t}. The learner said: "${m}". Ask about one edge case or improvement.`,
  },
  product_thinking: {
    agent: AgentType.Mentor,
    role: 'Product mentor',
    rubric: ['User empathy', 'Prioritization', 'Metrics'],
    scenario: (t) => `Product-thinking round on ${t}. Who is the user and what problem are we solving with ${t}?`,
    frame: (t, m) => `Product thinking on ${t}. The learner said: "${m}". Push on prioritization or metrics, then ask the next question.`,
  },
  mentor_review: {
    agent: AgentType.Mentor,
    role: 'Mentor',
    rubric: ['Progress', 'Blockers', 'Plan'],
    scenario: (t) => `Mentor review on ${t}. Tell me where you are with ${t} and what's blocking you.`,
    frame: (t, m) => `Mentor review on ${t}. The learner said: "${m}". Give encouragement + one concrete next step, then ask a follow-up.`,
  },
  group_discussion: {
    agent: AgentType.Mentor,
    role: 'Moderator',
    rubric: ['Contribution', 'Listening', 'Reasoning'],
    scenario: (t) => `Group discussion on ${t}. State your opening position on ${t}.`,
    frame: (t, m) => `GD on ${t}. A participant said: "${m}". Add a counter-point and invite the next contribution.`,
  },
  client_requirements: {
    agent: AgentType.Career,
    role: 'Client',
    rubric: ['Question quality', 'Scope clarity', 'Confirmation'],
    scenario: (t) => `Requirement-gathering on ${t}. I'm your client — I vaguely want "${t}". Ask me questions to pin down the scope.`,
    frame: (t, m) => `Client call about ${t}. The consultant asked/said: "${m}". Answer as a slightly vague client, then wait for the next question.`,
  },
  teaching_back: {
    agent: AgentType.Tutor,
    role: 'Curious student',
    rubric: ['Explanation clarity', 'Analogy', 'Checking understanding'],
    scenario: (t) => `Teach-back on ${t}. I'm your student — teach me ${t} from scratch. Start whenever you're ready.`,
    frame: (t, m) => `Teach-back on ${t}. The teacher said: "${m}". Ask a naive but pointed student question.`,
  },
};

/** Deterministic rubric-based score from engagement when no LLM grader is available. */
export function scoreSimulation(userTurns: string[]): { score: number; perCriterion: number } {
  if (userTurns.length === 0) return { score: 35, perCriterion: 35 };
  const avgLen = userTurns.reduce((s, t) => s + t.length, 0) / userTurns.length;
  const depth = Math.min(35, Math.round(avgLen / 6)); // longer answers → more depth (capped)
  const engagement = Math.min(35, userTurns.length * 9);
  const score = Math.max(40, Math.min(95, 30 + depth + engagement));
  return { score, perCriterion: score };
}
