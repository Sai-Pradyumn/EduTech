import { Logger } from '@nestjs/common';
import { Difficulty } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { LessonComposerService } from './lesson-composer.service';

/**
 * Full lesson bodies must be written for THIS lesson when live; offline or on
 * failure the learner gets the honest design outline, never fake depth.
 */

const COURSE = {
  title: 'Watercolor Painting: From First Wash to Finished Piece',
  goal: 'watercolor painting for beginners',
  level: Difficulty.Beginner,
  audience: 'hobby painters',
};
const MODULE = {
  title: 'Materials & first washes',
  summary: 'Paper, brushes, pigment behaviour.',
};
const LESSON = {
  title: 'Flat and graded washes',
  content: 'Practice edge control with a graded sky wash.',
  estimateMinutes: 30,
};

const LIVE_BODY =
  'A graded wash is the foundation of every luminous watercolor sky. ' +
  'In this lesson you will load a large round brush and learn how water-to-pigment ' +
  'ratio controls the gradient.\n\n## Loading the brush\n' +
  'Start with a puddle of paint...\n\n## The tilt technique\n' +
  'Tilt the board 15 degrees so gravity pulls each stroke into the next...\n\n' +
  '## Common pitfalls\n- Going back into a drying wash creates blooms.\n' +
  '- Too little water gives hard stripes.\n\n## Try it yourself\n' +
  'Paint three 10cm graded swatches from full-strength ultramarine to clear water.\n\n' +
  '## Recap\n- Ratio controls value\n- Tilt keeps the bead moving\n- Never rework a drying wash';

function composer(over: Partial<Record<string, unknown>> = {}) {
  const ai = {
    isLive: over.isLive ?? true,
    generateStructuredOutput: jest
      .fn()
      .mockResolvedValue(over.output ?? { body: LIVE_BODY }),
  } as unknown as AiService & { generateStructuredOutput: jest.Mock };
  return { svc: new LessonComposerService(ai), ai };
}

describe('LessonComposerService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('live: writes a full lesson specific to THIS lesson', async () => {
    const { svc, ai } = composer();
    const body = await svc.compose('u1', COURSE, MODULE, LESSON);
    expect(body).toContain('graded wash');
    expect(body).toContain('## Common pitfalls');
    // The prompt carries the exact grounding (course goal + lesson brief).
    const calls = ai.generateStructuredOutput.mock.calls as [
      { content: string }[],
    ][];
    const user = calls[0][0].find((m) =>
      m.content.includes('watercolor painting for beginners'),
    );
    expect(user).toBeTruthy();
    expect(user!.content).toContain('graded sky wash');
  });

  it('degenerate output (too short to teach) falls back to the honest outline', async () => {
    const { svc } = composer({ output: { body: 'Washes are nice.' } });
    const body = await svc.compose('u1', COURSE, MODULE, LESSON);
    expect(body).toContain('lesson outline from the course design');
    expect(body).toContain(LESSON.title);
  });

  it('offline: outline without calling the model', async () => {
    const { svc, ai } = composer({ isLive: false });
    const body = await svc.compose('u1', COURSE, MODULE, LESSON);
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled();
    expect(body).toContain('needs a live AI provider');
    expect(body).toContain('Practice edge control');
  });

  it('a provider error never blocks opening a lesson', async () => {
    const { svc, ai } = composer();
    ai.generateStructuredOutput.mockRejectedValueOnce(new Error('down'));
    const body = await svc.compose('u1', COURSE, MODULE, LESSON);
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain(LESSON.title);
  });
});
