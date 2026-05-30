/**
 * Asta Synapse — shared types + token maps for the metaphor-driven component
 * library. See client/src/app/shared/design/ASTA_SYNAPSE_DESIGN_SYSTEM.md.
 */

/** Accent tones map to the Synapse hue ramp (or the contextual `--asta-accent`). */
export type SynapseTone = 'accent' | 'blue' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'indigo';

/** tone → CSS colour variable. `accent` follows the contextual palette
 *  (brand-green for students, cool for the admin observatory). */
export const TONE_VAR: Record<SynapseTone, string> = {
  accent: 'var(--asta-accent)',
  blue: 'var(--asta-blue)',
  cyan: 'var(--asta-cyan)',
  violet: 'var(--asta-violet)',
  emerald: 'var(--asta-emerald)',
  amber: 'var(--asta-amber)',
  rose: 'var(--asta-rose)',
  indigo: 'var(--asta-indigo)',
};

/** A milestone on the learning river. */
export type RiverNodeState = 'completed' | 'active' | 'upcoming' | 'locked';
export interface RiverNode {
  label: string;
  state: RiverNodeState;
  hint?: string;
}

/** An event on a signal timeline. */
export interface SignalEvent {
  time: string;
  title: string;
  detail?: string;
  tone?: SynapseTone;
  active?: boolean;
}

/** A step on the step tracker (weeks, milestones, project phases…). */
export type StepState = 'completed' | 'active' | 'upcoming' | 'locked';
export interface StepItem {
  title: string;
  detail?: string;
  /** Sub-items shown when this step is the active one (e.g. the week's tasks). */
  tasks?: string[];
  state: StepState;
  /** Whether this step shows the explicit "Mark complete" toggle. */
  actionable?: boolean;
}

/** An orbiting agent in the swarm. */
export type AgentOrbitState = 'idle' | 'listening' | 'retrieving' | 'reasoning' | 'validating' | 'streaming' | 'complete' | 'failed';
export interface AgentOrbit {
  name: string;
  state: AgentOrbitState;
  detail: string;
  tone?: SynapseTone;
}
