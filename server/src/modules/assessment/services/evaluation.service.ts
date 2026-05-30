import { Injectable } from '@nestjs/common';
import { QuestionType } from '../../../common/enums';
import { QuizQuestion } from '../schemas/quiz.schema';

export interface SubmittedAnswer {
  questionIndex: number;
  answerIndex?: number;
  text?: string;
}

export interface GradedQuestion {
  questionIndex: number;
  topic: string;
  answerIndex?: number;
  text: string;
  correct: boolean;
  earned: number;
  points: number;
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
  severity: number; // 0..100
}

export interface Evaluation {
  score: number; // 0..100
  correctCount: number;
  total: number;
  results: GradedQuestion[];
  topicScores: TopicScore[];
  weakTopics: string[];
  feedback: string;
}

const KEYWORD_PASS = 0.5; // fraction of expected keywords needed for a free-text answer.

/** Grades a quiz attempt and turns wrong answers into a weak-topic profile + feedback. */
@Injectable()
export class EvaluationService {
  evaluate(questions: QuizQuestion[], answers: SubmittedAnswer[]): Evaluation {
    const byIndex = new Map(answers.map((a) => [a.questionIndex, a]));
    const results: GradedQuestion[] = [];
    let earnedTotal = 0;
    let pointsTotal = 0;
    let correctCount = 0;

    questions.forEach((q, i) => {
      const points = q.points || 1;
      pointsTotal += points;
      const submitted = byIndex.get(i);
      const correct = this.isCorrect(q, submitted);
      const earned = correct ? points : 0;
      earnedTotal += earned;
      if (correct) correctCount += 1;
      results.push({
        questionIndex: i,
        topic: q.topic || 'general',
        answerIndex: submitted?.answerIndex,
        text: submitted?.text ?? '',
        correct,
        earned,
        points,
      });
    });

    const topicScores = this.topicScores(results);
    const weakTopics = topicScores.filter((t) => t.severity >= 50).map((t) => t.topic);
    const score = pointsTotal === 0 ? 0 : Math.round((earnedTotal / pointsTotal) * 100);

    return {
      score,
      correctCount,
      total: questions.length,
      results,
      topicScores,
      weakTopics,
      feedback: this.feedback(score, weakTopics, topicScores),
    };
  }

  private isCorrect(q: QuizQuestion, a?: SubmittedAnswer): boolean {
    if (!a) return false;
    if (q.type === QuestionType.Mcq) {
      return typeof a.answerIndex === 'number' && a.answerIndex === q.answerIndex;
    }
    // short_answer / coding — keyword coverage against expected terms (mock grading).
    const text = (a.text ?? '').toLowerCase();
    if (!text.trim()) return false;
    const expected = q.keywords.length ? q.keywords : this.terms(q.modelAnswer);
    if (expected.length === 0) return text.length > 10; // no rubric → accept a real attempt
    const matched = expected.filter((k) => text.includes(k.toLowerCase())).length;
    return matched / expected.length >= KEYWORD_PASS;
  }

  private topicScores(results: GradedQuestion[]): TopicScore[] {
    const map = new Map<string, { correct: number; total: number }>();
    for (const r of results) {
      const e = map.get(r.topic) ?? { correct: 0, total: 0 };
      e.total += 1;
      if (r.correct) e.correct += 1;
      map.set(r.topic, e);
    }
    return [...map.entries()]
      .map(([topic, { correct, total }]) => ({
        topic,
        correct,
        total,
        severity: Math.round((1 - correct / total) * 100),
      }))
      .sort((a, b) => b.severity - a.severity);
  }

  private feedback(score: number, weakTopics: string[], topics: TopicScore[]): string {
    const band =
      score >= 80 ? 'Strong work' : score >= 50 ? 'Solid start' : 'Keep going — this is how you improve';
    const weakLine = weakTopics.length
      ? `Focus next on: ${weakTopics.join(', ')}.`
      : 'No major weak spots detected — try a harder difficulty next.';
    const strongest = topics.find((t) => t.severity === 0);
    const strongLine = strongest ? ` You nailed ${strongest.topic}.` : '';
    return `${band} — you scored ${score}%.${strongLine} ${weakLine}`;
  }

  private terms(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 3);
  }
}
