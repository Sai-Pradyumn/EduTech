import { Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { InterviewCoachAgent } from './interview.agent';
import { buildQuestions } from './interview-bank';

/** Hermetic: fake AiService; proves tailored generation + every fallback path. */

function coach(over: Partial<Record<string, unknown>> = {}) {
  const ai = {
    isLive: over.isLive ?? true,
    generateStructuredOutput: jest.fn().mockResolvedValue(
      over.output ?? {
        questions: [
          'Given your weak area in CSS layout, how would you center a dialog?',
          'Your goal mentions MERN — how does Express middleware chaining work?',
          'Walk me through state management options you have actually used.',
          'How would you debug a slow MongoDB query in your stack?',
          'What trade-off did you make in your last project and why?',
        ],
      },
    ),
  } as unknown as AiService & { generateStructuredOutput: jest.Mock };
  return { agent: new InterviewCoachAgent(ai), ai };
}

describe('InterviewCoachAgent.generateQuestions', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('generates learner-tailored questions when AI is live', async () => {
    const { agent, ai } = coach();
    const qs = await agent.generateQuestions(
      'u1',
      'frontend',
      'Frontend Developer',
      {
        mainGoal: 'MERN stack developer',
        weakAreas: ['CSS layout'],
      },
    );
    expect(qs.length).toBe(5);
    expect(qs[0]).toContain('CSS');
    // The learner grounding must be in the prompt.
    const calls = ai.generateStructuredOutput.mock.calls as [
      { content: string }[],
    ][];
    const userMsg = calls[0][0].find((m) => m.content.includes('Weak areas'));
    expect(userMsg?.content).toContain('CSS layout');
  });

  it('falls back to the bank when AI is offline', async () => {
    const { agent, ai } = coach({ isLive: false });
    const qs = await agent.generateQuestions('u1', 'hr', 'Backend Developer');
    expect(qs).toEqual(buildQuestions('hr', 'Backend Developer'));
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled();
  });

  it('falls back to the bank on a degenerate generation (too few usable)', async () => {
    const { agent } = coach({ output: { questions: ['hi', 'ok?'] } });
    const qs = await agent.generateQuestions('u1', 'dsa', 'SDE');
    expect(qs).toEqual(buildQuestions('dsa', 'SDE'));
  });

  it('falls back to the bank when generation throws', async () => {
    const { agent, ai } = coach();
    ai.generateStructuredOutput.mockRejectedValueOnce(
      new Error('provider down'),
    );
    const qs = await agent.generateQuestions('u1', 'technical', 'SDE');
    expect(qs).toEqual(buildQuestions('technical', 'SDE'));
  });
});
