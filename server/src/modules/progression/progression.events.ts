/** Domain events that let Asta react autonomously to a student's progress. */

export const PROGRESSION_EVENTS = {
  quizGraded: 'progression.quiz.graded',
  weekCompleted: 'progression.roadmap.week_completed',
  projectSubmitted: 'progression.project.submitted',
  flowRepairCompleted: 'progression.flow.repair_completed',
} as const;

export interface QuizGradedEvent {
  userId: string;
  quizId: string;
  quizTitle: string;
  topic: string;
  score: number; // 0..100
  weakTopics: string[];
  /** Per-topic weakness severity (0..100) — consumed by Mistake OS to create repair entries. */
  topicScores?: { topic: string; severity: number }[];
}

export interface WeekCompletedEvent {
  userId: string;
  roadmapTitle: string;
  weekNumber: number;
  nextWeekFocus?: string;
}

export interface ProjectSubmittedEvent {
  userId: string;
  projectId: string;
  projectTitle: string;
}

/** A flow's weak-area-repair node was mastered — Mistake OS closes the matching gap. */
export interface FlowRepairCompletedEvent {
  userId: string;
  concept: string;
  flowTitle: string;
}
