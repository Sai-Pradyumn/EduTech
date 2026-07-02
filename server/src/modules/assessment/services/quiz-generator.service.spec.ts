import { Logger } from '@nestjs/common';
import { Difficulty, QuestionType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { QuizGeneratorService } from './quiz-generator.service';

/**
 * Quiz questions must be written for THIS topic/document when AI is live;
 * the bank/cloze paths are strictly the offline fallback.
 */

const LIVE_QUESTIONS = {
  questions: [
    {
      prompt:
        'In a Kubernetes Deployment, what does the replicas field control?',
      options: [
        'How many Pod copies run at once',
        'How many containers run in one Pod',
        'How many nodes join the cluster',
        'How many images the registry keeps',
      ],
      answerIndex: 0,
      explanation: 'replicas sets the desired number of identical Pods.',
    },
    {
      prompt: 'Which object gives Pods a stable network identity?',
      options: ['Service', 'ConfigMap', 'Secret', 'Namespace'],
      answerIndex: 0,
      explanation: 'A Service fronts Pods with a stable virtual IP.',
    },
  ],
};

function gen(over: Partial<Record<string, unknown>> = {}) {
  const ai = {
    isLive: over.isLive ?? true,
    generateStructuredOutput: jest
      .fn()
      .mockResolvedValue(over.output ?? LIVE_QUESTIONS),
  } as unknown as AiService & { generateStructuredOutput: jest.Mock };
  return { generator: new QuizGeneratorService(ai), ai };
}

describe('QuizGeneratorService (smart paths)', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('live topic quiz: AI-written questions with full scoring metadata', async () => {
    const { generator } = gen();
    const qs = await generator.smartFromTopic(
      'u1',
      'kubernetes',
      Difficulty.Intermediate,
      2,
    );
    expect(qs).toHaveLength(2);
    expect(qs[0].type).toBe(QuestionType.Mcq);
    expect(qs[0].prompt).toContain('replicas');
    expect(qs[0].modelAnswer).toBe('How many Pod copies run at once');
    expect(qs[0].points).toBe(2); // intermediate
    expect(qs[0].keywords.length).toBeGreaterThan(0);
  });

  it('live document quiz: the prompt carries the actual excerpts (grounding)', async () => {
    const { generator, ai } = gen();
    await generator.smartFromDocument(
      'u1',
      'DBMS',
      [
        {
          text: 'Third normal form removes transitive dependencies.',
          headingPath: 'Normalization',
          keywords: ['normal', 'form'],
        },
      ],
      Difficulty.Beginner,
      2,
    );
    const calls = ai.generateStructuredOutput.mock.calls as [
      { content: string }[],
    ][];
    const user = calls[0][0].find((m) =>
      m.content.includes('transitive dependencies'),
    );
    expect(user).toBeTruthy();
    expect(user!.content).toContain('ONLY from these excerpts');
  });

  it('degenerate generation (too few 4-option questions) falls back to the bank', async () => {
    const { generator } = gen({
      output: {
        questions: [
          { prompt: 'bad', options: ['a', 'b'], answerIndex: 0 },
          { prompt: 'x', options: ['1', '2', '3'], answerIndex: 0 },
        ],
      },
    });
    const qs = await generator.smartFromTopic(
      'u1',
      'javascript',
      Difficulty.Beginner,
      4,
    );
    // Deterministic path: still a full quiz, honestly generated offline.
    expect(qs).toHaveLength(4);
    expect(qs.every((q) => q.options.length >= 2)).toBe(true);
  });

  it('offline uses the deterministic path without calling the model', async () => {
    const { generator, ai } = gen({ isLive: false });
    const qs = await generator.smartFromTopic(
      'u1',
      'sql',
      Difficulty.Beginner,
      3,
    );
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled();
    expect(qs).toHaveLength(3);
  });

  it('a provider error never blocks quiz creation', async () => {
    const { generator, ai } = gen();
    ai.generateStructuredOutput.mockRejectedValueOnce(new Error('down'));
    const qs = await generator.smartFromTopic(
      'u1',
      'react',
      Difficulty.Advanced,
      3,
    );
    expect(qs).toHaveLength(3);
  });
});
