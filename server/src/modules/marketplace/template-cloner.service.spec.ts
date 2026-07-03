import { Logger } from '@nestjs/common';
import { TemplateClonerService } from './template-cloner.service';
import { MarketplaceTemplateDocument } from './schemas/marketplace-template.schema';

/**
 * "Use template" must produce a REAL personal asset via each type's own
 * generation pipeline (or, for live-session types, seed the create screen) —
 * never the old silent no-op.
 */
function gen(id: string): jest.Mock {
  return jest.fn().mockResolvedValue({ _id: id });
}

function make(over: Partial<Record<string, jest.Mock>> = {}) {
  const flows = { generate: over.flows ?? gen('flow1') };
  const roadmaps = { generate: over.roadmaps ?? gen('road1') };
  const assessment = { generate: over.assessment ?? gen('quiz1') };
  const projects = { generate: over.projects ?? gen('proj1') };
  const visuals = { generate: over.visuals ?? gen('vis1') };
  const courses = { generate: over.courses ?? gen('course1') };
  const s = new TemplateClonerService(
    flows as never,
    roadmaps as never,
    assessment as never,
    projects as never,
    visuals as never,
    courses as never,
  );
  return { s, flows, roadmaps, assessment, projects, visuals, courses };
}

function tpl(
  type: string,
  over: Partial<Record<string, unknown>> = {},
): MarketplaceTemplateDocument {
  return {
    type,
    title: 'Master React',
    level: 'intermediate',
    content: {},
    ...over,
  } as unknown as MarketplaceTemplateDocument;
}

describe('TemplateClonerService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('flow: generates a real flow and deep-links to it', async () => {
    const { s, flows } = make();
    const r = await s.clone('u1', tpl('flow'));
    expect(flows.generate).toHaveBeenCalledWith('u1', { goal: 'Master React' });
    expect(r).toEqual({
      created: true,
      assetId: 'flow1',
      route: '/app/flows/flow1',
    });
  });

  it('prefers content.goal over the template title', async () => {
    const { s, flows } = make();
    await s.clone('u1', tpl('flow', { content: { goal: 'Learn Rust' } }));
    expect(flows.generate).toHaveBeenCalledWith('u1', { goal: 'Learn Rust' });
  });

  it('quiz: generates from topic with mapped difficulty, lands on the quiz list', async () => {
    const { s, assessment } = make();
    const r = await s.clone(
      'u1',
      tpl('quiz', { level: 'advanced', content: { topic: 'Hooks' } }),
    );
    expect(assessment.generate).toHaveBeenCalledWith('u1', {
      source: 'topic',
      topic: 'Hooks',
      difficulty: 'advanced',
    });
    expect(r).toMatchObject({
      created: true,
      assetId: 'quiz1',
      route: '/app/quizzes',
    });
  });

  it('course: deep-links to the created course', async () => {
    const { s } = make();
    const r = await s.clone('u1', tpl('course'));
    expect(r).toEqual({
      created: true,
      assetId: 'course1',
      route: '/app/course-builder/course1',
    });
  });

  it('visual: uses content.visualType when valid, else defaults to mind_map', async () => {
    const { s, visuals } = make();
    await s.clone(
      'u1',
      tpl('visual', { content: { visualType: 'timeline', concept: 'HTTP' } }),
    );
    expect(visuals.generate).toHaveBeenCalledWith('u1', {
      concept: 'HTTP',
      type: 'timeline',
      level: 'intermediate',
    });
    await s.clone('u1', tpl('visual', { content: { visualType: 'nonsense' } }));
    expect(visuals.generate).toHaveBeenLastCalledWith(
      'u1',
      expect.objectContaining({ type: 'mind_map' }),
    );
  });

  it('live-session type (simulation): no clone, seeds the create screen with the goal', async () => {
    const { s, flows } = make();
    const r = await s.clone('u1', tpl('simulation', { title: 'Debug prod' }));
    expect(r).toEqual({
      created: false,
      assetId: null,
      route: '/app/simulations',
      queryParams: { from: 'template', goal: 'Debug prod' },
    });
    expect(flows.generate).not.toHaveBeenCalled();
  });
});
