/** Learning-Intelligence cockpit models — mirror the server engine output. */

export interface ScoreCard {
  label: string;
  value: number;
  hint: string;
}
export interface IntelRadarAxis {
  label: string;
  value: number;
  target: number;
}
export interface IntelWeakness {
  topic: string;
  severity: number;
  note: string;
}
export interface TimelineItem {
  kind: 'quiz' | 'chat' | 'roadmap';
  label: string;
  detail?: string;
  at: string;
}
export interface LearningIntelligence {
  hasData: boolean;
  headline: string;
  healthScore: number;
  readinessScore: number;
  scores: ScoreCard[];
  radar: IntelRadarAxis[];
  weaknesses: IntelWeakness[];
  strengths: string[];
  momentum: { activeDays: number; streak: number; sessions: number; quizzes: number; attempts: number; projects: number };
  trend: { label: string; score: number }[];
  timeline: TimelineItem[];
  recommendations: string[];
}
