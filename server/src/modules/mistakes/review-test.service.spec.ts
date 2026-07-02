import { BadRequestException } from '@nestjs/common';
import { QuizGeneratorService } from '../assessment/services/quiz-generator.service';
import { MistakesService } from './mistakes.service';
import { ReviewTestService } from './review-test.service';

/**
 * "Test me": evidence-based spaced review. Answers never leave the server;
 * grading feeds the same SM-2-lite scheduler as a manual review.
 */

const MISTAKE = {
  _id: 'm1',
  concept: 'recursion base cases',
  topic: 'DSA',
  severity: 55,
};

const QUESTIONS = [
  {
    prompt: 'What happens without a base case?',
    options: ['Stack overflow', 'Faster runtime', 'Compile error', 'Nothing'],
    modelAnswer: 'Stack overflow',
  },
  {
    prompt: 'A base case should…',
    options: ['Recurse deeper', 'Return without recursing', 'Throw', 'Loop'],
    modelAnswer: 'Return without recursing',
  },
];

function build() {
  const quizzes = {
    smartFromTopic: jest.fn().mockResolvedValue(QUESTIONS),
  } as unknown as QuizGeneratorService & { smartFromTopic: jest.Mock };
  const mistakes = {
    get: jest.fn().mockResolvedValue(MISTAKE),
    review: jest
      .fn()
      .mockImplementation((_u: string, id: string, recalled: boolean) =>
        Promise.resolve({ ...MISTAKE, _id: id, recalled }),
      ),
  } as unknown as MistakesService & { get: jest.Mock; review: jest.Mock };
  return { svc: new ReviewTestService(quizzes, mistakes), quizzes, mistakes };
}

describe('ReviewTestService', () => {
  it('start returns real questions and never leaks the answers', async () => {
    const { svc, quizzes } = build();
    const { questions } = await svc.start('u1', 'm1');
    expect(quizzes.smartFromTopic).toHaveBeenCalledWith(
      'u1',
      'recursion base cases (DSA)',
      expect.any(String),
      2,
    );
    expect(questions).toHaveLength(2);
    for (const q of questions) {
      expect(Object.keys(q).sort()).toEqual(['options', 'prompt']);
    }
  });

  it('a passing submission records a successful review', async () => {
    const { svc, mistakes } = build();
    await svc.start('u1', 'm1');
    const r = await svc.submit('u1', 'm1', [0, 1]); // both correct
    expect(r.correct).toBe(2);
    expect(r.passed).toBe(true);
    expect(mistakes.review).toHaveBeenCalledWith('u1', 'm1', true);
  });

  it('a failing submission resurfaces the concept sooner', async () => {
    const { svc, mistakes } = build();
    await svc.start('u1', 'm1');
    const r = await svc.submit('u1', 'm1', [3, 0]); // both wrong
    expect(r.passed).toBe(false);
    expect(mistakes.review).toHaveBeenCalledWith('u1', 'm1', false);
  });

  it('submitting without a started (or already-used) test is rejected', async () => {
    const { svc } = build();
    await expect(svc.submit('u1', 'm1', [0, 1])).rejects.toThrow(
      BadRequestException,
    );
    await svc.start('u1', 'm1');
    await svc.submit('u1', 'm1', [0, 1]);
    // One-shot: the same test cannot be submitted twice.
    await expect(svc.submit('u1', 'm1', [0, 1])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('no generatable questions → honest rejection (fall back to self-report)', async () => {
    const { svc, quizzes } = build();
    quizzes.smartFromTopic.mockResolvedValueOnce([]);
    await expect(svc.start('u1', 'm1')).rejects.toThrow(BadRequestException);
  });
});
