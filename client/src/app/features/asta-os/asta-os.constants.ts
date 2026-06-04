import { AgentStreamEvent, AgentType } from '../../core/models';
import {
  AstaLearningMode,
  AstaLearningModeMeta,
  AstaQuickChip,
  AstaSessionMode,
  AstaSessionModeMeta,
  AstaTrustBadge,
  AstaTurn,
} from './asta-os.types';

/** Composer placeholder per session mode. */
export const COMPOSER_PLACEHOLDER: Record<AstaSessionMode, string> = {
  chat: 'Ask Asta to teach, quiz, debug, plan, or build…',
  voice: 'Tap the mic, or type — say “I have 30 minutes, teach me React hooks”…',
  face: 'Talk to Asta, or type here while you’re face to face…',
};

/** One-tap suggestions under the composer. */
export const QUICK_CHIPS: readonly AstaQuickChip[] = [
  { label: 'Continue today’s plan', prompt: 'Continue my plan for today' },
  { label: 'Fix my weak area', prompt: 'Help me fix my weakest topic' },
  { label: 'Practice coding', prompt: 'Give me a coding practice problem' },
  { label: 'Explain visually', prompt: 'Explain my current topic visually' },
  { label: 'Quiz me', prompt: 'Quiz me on what I’m learning' },
  { label: 'Build a project', prompt: 'Help me build a project' },
  { label: 'Prepare for interview', prompt: 'Prepare me for an interview' },
];

/** Segments of the Chat | Voice | Face selector. */
export const SESSION_MODES: readonly AstaSessionModeMeta[] = [
  { mode: 'chat', label: 'Chat', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z' },
  { mode: 'voice', label: 'Voice', icon: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3' },
  { mode: 'face', label: 'Face', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 10h.01M15.5 10h.01M8.5 15a4 4 0 0 0 7 0' },
];

/** Friendly, user-facing names for the internal agents (never shown as raw IDs). */
const AGENT_VERB: Record<AgentType, string> = {
  roadmap: 'shaping your learning path',
  tutor: 'thinking through the explanation',
  mentor: 'reviewing your progress',
  doubt_solver: 'working through your problem',
  rag: 'reading your sources',
  assessment: 'preparing practice checks',
  project_builder: 'planning your project',
  career: 'mapping your readiness',
  voice: 'getting ready to speak',
  content_creator: 'drafting study material',
  admin_insight: 'gathering insights',
};

/**
 * Translate a raw stream event into one calm, user-facing line — or `null` when
 * the event should not surface to the learner (chunks, completion bookkeeping).
 * Keeps all "Asta is …" copy in one place; components stay free of magic strings.
 */
export function friendlyActivity(event: AgentStreamEvent): string | null {
  switch (event.type) {
    case 'started':
      return 'Understood your goal';
    case 'plan':
      return event.steps.length > 1 ? 'Lining up the right steps' : null;
    case 'step_started':
      return `Asta is ${AGENT_VERB[event.agentType]}`;
    case 'thinking':
      return event.label;
    case 'tool_call':
      return 'Asta is checking your learning context';
    case 'tool_result':
      return 'Asta reviewed your learning context';
    default:
      return null;
  }
}

/** Friendly, user-facing role name per internal agent (the badge under a turn). */
const AGENT_LABEL: Record<AgentType, string> = {
  roadmap: 'Path planner',
  tutor: 'Tutor',
  mentor: 'Mentor',
  doubt_solver: 'Doubt solver',
  rag: 'Your sources',
  assessment: 'Practice',
  project_builder: 'Project guide',
  career: 'Career coach',
  voice: 'Voice',
  content_creator: 'Study notes',
  admin_insight: 'Insights',
};

/** Human label for the agent that handled a turn, framed as part of Asta. */
export function agentLabel(agentType: AgentType | undefined): string {
  return agentType ? AGENT_LABEL[agentType] : 'Asta';
}

/** Short, friendly phrasing of a detected intent (kept calm; raw intent stays internal). */
export function intentLabel(intent: string | undefined): string | null {
  if (!intent) return null;
  const map: Record<string, string> = {
    learn: 'teaching this',
    explain: 'explaining this',
    practice: 'setting up practice',
    quiz: 'quizzing you',
    roadmap: 'planning your path',
    project: 'planning a project',
    career: 'mapping your readiness',
    debug: 'debugging with you',
    revise: 'helping you revise',
  };
  return map[intent] ?? null;
}

/**
 * Learning modes the learner (or Asta) can pick. Each maps to a real backend
 * TutorMode (server enum), so selecting "Hint-first" / "Socratic" genuinely
 * changes how the tutor agent responds — the Cognitive Guardian's hint-first
 * behavior, surfaced controllably rather than as a cosmetic label.
 */
export const LEARNING_MODES: readonly AstaLearningModeMeta[] = [
  { mode: 'balanced', label: 'Balanced tutor', tutorMode: 'explain', guiding: false },
  { mode: 'hint', label: 'Hint-first', tutorMode: 'hint', guiding: true },
  { mode: 'socratic', label: 'Strict Socratic', tutorMode: 'socratic', guiding: true },
  { mode: 'exam', label: 'Exam prep', tutorMode: 'exam', guiding: false },
  { mode: 'interview', label: 'Interview', tutorMode: 'interview', guiding: false },
  { mode: 'debug', label: 'Debug with me', tutorMode: 'debugging', guiding: true },
];

const LEARNING_MODE_BY_KEY: Record<AstaLearningMode, AstaLearningModeMeta> = LEARNING_MODES.reduce(
  (acc, m) => ({ ...acc, [m.mode]: m }),
  {} as Record<AstaLearningMode, AstaLearningModeMeta>,
);

/** Backend TutorMode string for a learning mode (passed to AgentService.stream). */
export function tutorModeFor(mode: AstaLearningMode): string {
  return LEARNING_MODE_BY_KEY[mode].tutorMode;
}

/** Whether a learning mode makes Asta guide hint-first instead of answering outright. */
export function isGuidingMode(mode: AstaLearningMode): boolean {
  return LEARNING_MODE_BY_KEY[mode].guiding;
}

/**
 * Cognitive-Guardian trust badges for a completed turn — derived only from real
 * signals (the validator always runs; sources/blocks/mode are facts of the run).
 * Never fabricated, never raw logs. Capped to keep the surface calm.
 */
export function deriveTrustBadges(turn: AstaTurn): AstaTrustBadge[] {
  const badges: AstaTrustBadge[] = [{ id: 'checked', label: 'Checked by Asta', tone: 'neutral' }];

  if (turn.sources.length) badges.push({ id: 'grounded', label: 'Grounded in your notes', tone: 'grounded' });

  const blockTypes = new Set(turn.blocks.map((b) => b.type));
  if (blockTypes.has('practice') || blockTypes.has('quiz')) {
    badges.push({ id: 'practice', label: 'Practice recommended', tone: 'practice' });
  }
  if (blockTypes.has('weakness_analysis')) {
    badges.push({ id: 'weak', label: 'Weak area detected', tone: 'weak' });
  }
  if (blockTypes.has('roadmap_timeline')) {
    badges.push({ id: 'roadmap', label: 'Roadmap update suggested', tone: 'roadmap' });
  }
  if (turn.learningMode && isGuidingMode(turn.learningMode)) {
    badges.push({ id: 'guiding', label: 'Guiding, not just answering', tone: 'guiding' });
  }

  return badges;
}

export const GREETING_PROMPT = 'What should we work on now?';
export const GREETING_SUBTEXT =
  'I can teach, quiz, debug, plan, generate visuals, build projects, or update your learning path.';
