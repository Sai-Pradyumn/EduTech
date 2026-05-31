import { MistakeType, RepairAction } from './schemas/mistake.schema';

/** Map a 0–100 severity to a mistake type (heuristic for topic-level capture). */
export function severityToType(severity: number): MistakeType {
  if (severity >= 75) return 'misconception';
  if (severity >= 50) return 'weak_recall';
  return 'careless_error';
}

const TYPE_CORRECTION: Record<MistakeType, string> = {
  misconception:
    'You hold an incorrect mental model here — rebuild it from the definition up, with one worked example.',
  missing_prerequisite:
    'A prerequisite is missing — patch the underlying concept before retrying this one.',
  careless_error:
    'You know this but slipped — slow down and verify each step on the retry.',
  weak_recall:
    'The idea is fuzzy — space out short recall reps until it is automatic.',
  poor_explanation:
    'You can do it but cannot explain it — practice teaching it back out loud.',
  implementation_gap:
    'Theory is fine but implementation is shaky — build a tiny project that forces this concept.',
  interview_communication_gap:
    'Reasoning is right but communication is unclear — rehearse a crisp spoken answer.',
  project_architecture_gap:
    'A design/architecture gap — review the pattern and re-draw the architecture.',
};

/**
 * Deterministic repair plan for a mistake. Produces concrete, routable actions across the
 * platform (micro-quiz, visual correction, tutor explanation, voice viva, flow repair node).
 */
export function buildRepairPlan(
  concept: string,
  type: MistakeType,
): { correction: string; actions: RepairAction[] } {
  const id = (k: string) =>
    `${k}_${concept
      .replace(/[^a-z0-9]+/gi, '')
      .slice(0, 12)
      .toLowerCase()}`;
  const actions: RepairAction[] = [
    {
      id: id('tutor'),
      kind: 'tutor_explanation',
      label: `Re-learn "${concept}" with the AI Tutor`,
      route: '/app/tutor',
      prompt: `I keep getting "${concept}" wrong. Re-teach it from first principles with one worked example, then check my understanding.`,
      done: false,
    },
    {
      id: id('visual'),
      kind: 'visual_correction',
      label: `See "${concept}" as a diagram`,
      route: '/app/visuals',
      prompt: concept,
      done: false,
    },
    {
      id: id('quiz'),
      kind: 'micro_quiz',
      label: `Micro-quiz on "${concept}"`,
      route: '/app/quizzes',
      prompt: concept,
      done: false,
    },
  ];
  // Communication/explanation gaps get a voice viva; everything else gets a flow repair node.
  if (type === 'interview_communication_gap' || type === 'poor_explanation') {
    actions.push({
      id: id('viva'),
      kind: 'voice_viva',
      label: `Explain "${concept}" aloud (voice viva)`,
      route: '/app/voice-room',
      prompt: `Run an oral viva on ${concept}.`,
      done: false,
    });
  } else {
    actions.push({
      id: id('flow'),
      kind: 'flow_repair_node',
      label: `Add a repair node to my active flow`,
      done: false,
    });
  }
  return { correction: TYPE_CORRECTION[type], actions };
}
