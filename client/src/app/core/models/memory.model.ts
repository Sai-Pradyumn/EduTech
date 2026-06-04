/** Frontend mirror of the learner-memory contract (server memory module). */

export type AstaMemoryType =
  | 'learning_goal'
  | 'career_goal'
  | 'time_availability'
  | 'preferred_modality'
  | 'weak_area'
  | 'pace_preference'
  | 'exam_target'
  | 'interview_target'
  | 'project_interest'
  | 'energy_pattern'
  | 'language_preference'
  | 'accessibility_preference';

export type MemoryDecision = 'save' | 'dismiss';

/** A memory-worthy statement Asta detected, awaiting the learner's confirmation. */
export interface AstaMemorySuggestion {
  type: AstaMemoryType;
  /** The raw value extracted from what the learner said. */
  value: string;
  /** The human line shown in the confirmation card ("You prefer visual learning"). */
  summary: string;
}

/** A confirmed, saved memory. */
export interface LearnerMemory {
  id: string;
  type: AstaMemoryType;
  value: string;
  summary: string;
  createdAt: string | null;
}
