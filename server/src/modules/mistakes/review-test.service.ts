import { BadRequestException, Injectable } from '@nestjs/common';
import { Difficulty } from '../../common/enums';
import { QuizGeneratorService } from '../assessment/services/quiz-generator.service';
import { MistakeDocument } from './schemas/mistake.schema';
import { MistakesService } from './mistakes.service';

/** An unanswered test is discarded after this long. */
const TEST_TTL_MS = 10 * 60_000;
const QUESTIONS_PER_TEST = 2;

interface PendingTest {
  answerIndexes: number[];
  expires: number;
}

export interface ReviewTestQuestions {
  questions: { prompt: string; options: string[] }[];
}

export interface ReviewTestResult {
  correct: number;
  total: number;
  passed: boolean;
  mistake: MistakeDocument;
}

/**
 * "Test me, don't trust me" — a due spaced review can be answered with REAL
 * questions instead of self-report. Questions come from the quiz generator for
 * the mistake's exact concept; answers are kept server-side (never sent to the
 * client) and grading feeds the same SM-2-lite scheduler as a manual review.
 */
@Injectable()
export class ReviewTestService {
  private readonly pending = new Map<string, PendingTest>();

  constructor(
    private readonly quizzes: QuizGeneratorService,
    private readonly mistakes: MistakesService,
  ) {}

  async start(userId: string, mistakeId: string): Promise<ReviewTestQuestions> {
    const m = await this.mistakes.get(userId, mistakeId);
    // High severity → probe the foundations; otherwise test at working level.
    const difficulty =
      m.severity >= 70 ? Difficulty.Beginner : Difficulty.Intermediate;
    const topic = m.topic ? `${m.concept} (${m.topic})` : m.concept;
    const questions = await this.quizzes.smartFromTopic(
      userId,
      topic,
      difficulty,
      QUESTIONS_PER_TEST,
    );
    if (!questions.length) {
      throw new BadRequestException(
        'Could not build a test for this concept — use Recalled/Forgot instead.',
      );
    }
    this.prune();
    this.pending.set(this.key(userId, mistakeId), {
      answerIndexes: questions.map((q) =>
        Math.max(0, q.options.indexOf(q.modelAnswer)),
      ),
      expires: Date.now() + TEST_TTL_MS,
    });
    // The correct answers stay server-side.
    return {
      questions: questions.map((q) => ({
        prompt: q.prompt,
        options: q.options,
      })),
    };
  }

  async submit(
    userId: string,
    mistakeId: string,
    answers: number[],
  ): Promise<ReviewTestResult> {
    const key = this.key(userId, mistakeId);
    const test = this.pending.get(key);
    if (!test || test.expires < Date.now()) {
      this.pending.delete(key);
      throw new BadRequestException('This test expired — start it again.');
    }
    this.pending.delete(key);
    const total = test.answerIndexes.length;
    const correct = test.answerIndexes.filter(
      (a, i) => answers[i] === a,
    ).length;
    const passed = correct >= Math.ceil(total / 2);
    // Same scheduler as a manual review — but backed by evidence.
    const mistake = await this.mistakes.review(userId, mistakeId, passed);
    return { correct, total, passed, mistake };
  }

  private key(userId: string, mistakeId: string): string {
    return `${userId}:${mistakeId}`;
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.pending)
      if (v.expires < now) this.pending.delete(k);
  }
}
