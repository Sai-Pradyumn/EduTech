import { FlowEdgeRelation, FlowNodeType } from '../../core/services/flow.service';

export interface NodeMeta {
  label: string;
  icon: string; // emoji glyph (dependency-free type icon)
  /** CSS color token role: 'learn' (green), 'ai' (cyan/violet), 'risk' (amber/red), 'neutral'. */
  tone: 'learn' | 'ai' | 'risk' | 'neutral' | 'gate';
}

/** Node type → display meta. Tone maps to the Noir palette rules (green=learning, cyan/violet=AI). */
export const FLOW_NODE_META: Record<string, NodeMeta> = {
  concept: { label: 'Concept', icon: '◆', tone: 'learn' },
  prerequisite: { label: 'Prerequisite', icon: '⊙', tone: 'neutral' },
  lesson: { label: 'Lesson', icon: '▸', tone: 'learn' },
  practice: { label: 'Practice', icon: '✎', tone: 'learn' },
  quiz: { label: 'Quiz checkpoint', icon: '✓', tone: 'ai' },
  project: { label: 'Project', icon: '⬢', tone: 'learn' },
  checkpoint: { label: 'Checkpoint', icon: '⚑', tone: 'ai' },
  weak_area_repair: { label: 'Weak-area repair', icon: '⚠', tone: 'risk' },
  mentor_review: { label: 'Mentor review', icon: '☺', tone: 'ai' },
  voice_practice: { label: 'Voice viva', icon: '🎙', tone: 'ai' },
  simulation: { label: 'Simulation', icon: '⚙', tone: 'ai' },
  document_source: { label: 'Document source', icon: '▤', tone: 'neutral' },
  diagram: { label: 'Diagram', icon: '▦', tone: 'ai' },
  image: { label: 'Image', icon: '▩', tone: 'ai' },
  mastery_gate: { label: 'Mastery gate', icon: '★', tone: 'gate' },
};

export const NODE_TYPE_ORDER: FlowNodeType[] = [
  'prerequisite',
  'concept',
  'lesson',
  'practice',
  'quiz',
  'checkpoint',
  'weak_area_repair',
  'project',
  'voice_practice',
  'simulation',
  'mentor_review',
  'document_source',
  'diagram',
  'image',
  'mastery_gate',
];

export const EDGE_META: Record<FlowEdgeRelation, { label: string; dashed: boolean }> = {
  prerequisite: { label: 'prerequisite', dashed: false },
  unlocks: { label: 'unlocks', dashed: false },
  reinforces: { label: 'reinforces', dashed: true },
  tests: { label: 'tests', dashed: true },
  depends_on: { label: 'depends on', dashed: false },
  alternative_path: { label: 'alternative', dashed: true },
  weak_area_patch: { label: 'repairs', dashed: true },
  project_application: { label: 'applied in', dashed: true },
};

/** Resolve the CSS color for a tone (kept here so both list + canvas agree). */
export function toneColor(tone: NodeMeta['tone']): string {
  switch (tone) {
    case 'learn':
      return 'var(--green)';
    case 'ai':
      return 'var(--peri, #8aa6ff)';
    case 'risk':
      return 'var(--coral, #ffb454)';
    case 'gate':
      return 'var(--green-deep)';
    default:
      return 'var(--text-mute)';
  }
}
