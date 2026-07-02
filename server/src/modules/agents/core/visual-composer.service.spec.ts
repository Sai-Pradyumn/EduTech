import { Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { VisualComposerService } from './visual-composer.service';

/**
 * The contract the user experience depends on: visuals are generated FROM the
 * actual answer, appear only when warranted, malformed generations degrade to
 * the structural derivation, and offline behaviour is honest (no templates).
 */

function svc(over: Partial<Record<string, unknown>> = {}) {
  const ai = {
    isLive: over.isLive ?? true,
    generateStructuredOutput: jest.fn().mockResolvedValue(
      over.output ?? { kind: 'none' },
    ),
  } as unknown as AiService & { generateStructuredOutput: jest.Mock };
  return { visuals: new VisualComposerService(ai), ai };
}

const STRUCTURED_ANSWER = [
  '### Event loop',
  'The event loop coordinates work.',
  '1. Call stack runs sync code',
  '2. Microtasks drain after each task',
  '3. Macrotasks (timers, IO) queue up',
  '- Rendering happens between tasks',
].join('\n');

describe('VisualComposerService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('live: attaches the model-built visual grounded in the answer', async () => {
    const { visuals, ai } = svc({
      output: {
        kind: 'concept_map',
        title: 'Event loop',
        nodes: [
          { id: 'a', label: 'Call stack' },
          { id: 'b', label: 'Microtasks' },
          { id: 'c', label: 'Macrotasks' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
    });
    const blocks = await visuals.compose(
      'how does the event loop work?',
      STRUCTURED_ANSWER,
      { topic: 'event loop', agentType: 'tutor' as never },
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('concept_map');
    // The model got the ACTUAL answer to ground on.
    const prompt = (
      ai.generateStructuredOutput.mock.calls[0] as unknown[]
    )[0] as { content: string }[];
    expect(prompt[1].content).toContain('Microtasks drain');
  });

  it('live: respects the model saying "none" — no visual attached', async () => {
    const { visuals } = svc({ output: { kind: 'none' } });
    const blocks = await visuals.compose('thanks, that helped!', 'You’re welcome — go build something!', {
      agentType: 'tutor' as never,
    });
    expect(blocks).toEqual([]);
  });

  it('live: a malformed generation degrades to the structural derivation', async () => {
    const { visuals } = svc({
      output: {
        kind: 'concept_map',
        nodes: [{ id: 'a', label: 'Only one node' }],
        edges: [{ from: 'a', to: 'ghost' }],
      },
    });
    const blocks = await visuals.compose(
      'explain the event loop',
      STRUCTURED_ANSWER,
      { topic: 'event loop', agentType: 'tutor' as never },
    );
    // Derivation kicks in: nodes come from THIS answer's sections.
    expect(blocks).toHaveLength(1);
    const labels = (blocks[0] as { nodes: { label: string }[] }).nodes.map((n) => n.label);
    expect(labels.join(' ')).toContain('Call stack runs sync code');
  });

  it('offline: derives the visual from the answer structure (dynamic per response)', async () => {
    const { visuals, ai } = svc({ isLive: false });
    const blocks = await visuals.compose(
      'explain the event loop',
      STRUCTURED_ANSWER,
      { topic: 'event loop', agentType: 'tutor' as never },
    );
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled();
    expect(blocks).toHaveLength(1);
    const map = blocks[0] as { title: string; nodes: { label: string }[] };
    expect(map.title).toContain('from this answer');
    expect(map.nodes.some((n) => n.label.includes('Microtasks'))).toBe(true);
  });

  it('offline: an unstructured answer gets NO visual (only when needed)', async () => {
    const { visuals } = svc({ isLive: false });
    const blocks = await visuals.compose(
      'explain closures',
      'A closure keeps access to its scope. That is the whole idea.',
      { topic: 'closures', agentType: 'tutor' as never },
    );
    expect(blocks).toEqual([]);
  });

  it('offline: a non-explanatory question gets NO visual even for structured answers', async () => {
    const { visuals } = svc({ isLive: false });
    const blocks = await visuals.compose('thanks!', STRUCTURED_ANSWER, {
      agentType: 'tutor' as never,
    });
    expect(blocks).toEqual([]);
  });

  it('quiz drafts are validated: only 4-option questions survive', async () => {
    const { visuals } = svc({
      output: {
        kind: 'quiz',
        title: 'Check yourself',
        questions: [
          {
            prompt: 'What drains after each task?',
            options: ['Microtasks', 'Macrotasks', 'The call stack', 'Rendering'],
            answerIndex: 0,
            explanation: 'Microtasks run to completion after each task.',
          },
          { prompt: 'Bad one', options: ['only', 'three', 'options'], answerIndex: 0 },
        ],
      },
    });
    const blocks = await visuals.compose('quiz me on the event loop', STRUCTURED_ANSWER, {
      agentType: 'tutor' as never,
    });
    expect(blocks).toHaveLength(1);
    const quiz = blocks[0] as { questions: unknown[] };
    expect(quiz.questions).toHaveLength(1);
  });
});
