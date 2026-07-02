import { Logger } from '@nestjs/common';
import { Difficulty } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { CourseArchitectAgent } from './course-architect.agent';
import { buildCourseBlueprint } from './course-blueprint.generator';

/** Course generation must be goal-specific when live, template only as the offline path. */

const GOAL = 'watercolor painting for beginners';

const LIVE_DRAFT = {
  title: 'Watercolor Painting: From First Wash to Finished Piece',
  description: 'Learn brush control, color mixing and composition.',
  modules: [
    {
      title: 'Materials & first washes',
      summary: 'Paper, brushes, pigment behaviour.',
      voiceScript: 'We start with what water actually does on paper.',
      lessons: [
        {
          title: 'Choosing paper and brushes',
          content: 'Cold-press vs hot-press; rounds vs flats; load a wash.',
          estimateMinutes: 20,
        },
        {
          title: 'Flat and graded washes',
          content: 'Practice edge control with a graded sky wash.',
          estimateMinutes: 30,
        },
      ],
    },
    {
      title: 'Color mixing',
      summary: 'Limited palettes and clean mixes.',
      lessons: [
        {
          title: 'The split-primary palette',
          content: 'Mix secondaries without mud using warm/cool primaries.',
        },
      ],
    },
    {
      title: 'Composition & light',
      summary: 'Values before color.',
      lessons: [
        {
          title: 'Value studies',
          content: 'Three-value thumbnails before painting.',
        },
      ],
    },
  ],
  project: {
    title: 'Paint a luminous landscape',
    brief: 'Apply washes, mixing and values in one piece.',
  },
  certificateCriteria: ['Finish all modules', 'Submit the landscape'],
};

function agent(over: Partial<Record<string, unknown>> = {}) {
  const ai = {
    isLive: over.isLive ?? true,
    generateStructuredOutput: jest
      .fn()
      .mockResolvedValue(over.output ?? LIVE_DRAFT),
  } as unknown as AiService & { generateStructuredOutput: jest.Mock };
  return { architect: new CourseArchitectAgent(ai), ai };
}

describe('CourseArchitectAgent', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('live: designs a goal-specific course with server-assigned ids', async () => {
    const { architect } = agent();
    const bp = await architect.blueprint('u1', GOAL, Difficulty.Beginner);
    expect(bp.title).toContain('Watercolor');
    expect(bp.modules).toHaveLength(3);
    expect(bp.modules[0].id).toBe('m_0');
    expect(bp.modules[0].lessons[1].id).toBe('m_0_l1');
    expect(bp.modules[0].lessons[1].content).toContain('graded sky wash');
    // Nothing generic slipped in.
    expect(JSON.stringify(bp.modules)).not.toContain('Core concepts');
  });

  it('degenerate generation (<3 usable modules) falls back to the blueprint', async () => {
    const { architect } = agent({
      output: {
        title: 'x',
        modules: [
          { title: 'only one', lessons: [{ title: 'l', content: 'c' }] },
        ],
      },
    });
    const bp = await architect.blueprint('u1', GOAL, Difficulty.Beginner);
    expect(bp).toEqual(
      buildCourseBlueprint(GOAL, Difficulty.Beginner, undefined),
    );
  });

  it('offline uses the deterministic blueprint without calling the model', async () => {
    const { architect, ai } = agent({ isLive: false });
    const bp = await architect.blueprint('u1', GOAL, Difficulty.Beginner);
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled();
    expect(bp.modules.length).toBeGreaterThanOrEqual(3);
  });

  it('a provider error falls back to the blueprint (course generation never fails)', async () => {
    const { architect, ai } = agent();
    ai.generateStructuredOutput.mockRejectedValueOnce(new Error('boom'));
    const bp = await architect.blueprint('u1', GOAL, Difficulty.Beginner);
    expect(bp).toEqual(
      buildCourseBlueprint(GOAL, Difficulty.Beginner, undefined),
    );
  });
});
