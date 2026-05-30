/** Quiz Studio models — mirror the server assessment contract. */
import type { Difficulty } from './roadmap.model';

export type QuizSource = 'topic' | 'document' | 'weak_area' | 'roadmap';
export type QuestionType = 'mcq' | 'short_answer' | 'coding';

export interface TakeQuestion {
  type: QuestionType;
  prompt: string;
  options: string[];
  topic: string;
  difficulty: Difficulty;
  source?: string;
}

export interface TakeQuiz {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  questions: TakeQuestion[];
}

export interface QuizSummary {
  id: string;
  title: string;
  topic: string;
  source: QuizSource;
  difficulty: Difficulty;
  questionCount: number;
  attemptCount: number;
  bestScore?: number;
  documentId?: string;
  createdAt: string;
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
  severity: number;
}

export interface ReviewQuestion extends TakeQuestion {
  answerIndex?: number;
  modelAnswer: string;
  explanation: string;
  yourAnswerIndex?: number;
  yourText: string;
  correct: boolean;
}

export interface AttemptView {
  id: string;
  quizId: string;
  score: number;
  correctCount: number;
  total: number;
  weakTopics: string[];
  feedback: string;
  createdAt: string;
}

export interface SubmitResult {
  attempt: AttemptView;
  evaluation: {
    score: number;
    correctCount: number;
    total: number;
    topicScores: TopicScore[];
    weakTopics: string[];
    feedback: string;
  };
  review: ReviewQuestion[];
}

export interface QuizAnswer {
  questionIndex: number;
  answerIndex?: number;
  text?: string;
}

export interface QuizStats {
  quizzes: number;
  attempts: number;
  averageScore: number;
  masteredTopics: string[];
  weakTopics: { topic: string; severity: number }[];
}

export interface GenerateQuizRequest {
  source: QuizSource;
  topic?: string;
  documentId?: string;
  difficulty?: Difficulty;
  count?: number;
}
