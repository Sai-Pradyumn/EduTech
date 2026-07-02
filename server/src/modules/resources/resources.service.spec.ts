import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { ResourcesService } from './resources.service';

/** Hermetic spec for the "for you" matching — the intelligence of the catalog. */

type Doc = Record<string, unknown>;

function fakeModel(docs: Doc[] | Doc | null) {
  const exec = jest.fn(() => Promise.resolve(docs));
  const chain: Record<string, unknown> = { exec };
  for (const m of ['sort', 'limit', 'lean']) chain[m] = jest.fn(() => chain);
  return {
    find: jest.fn(() => chain),
    findOne: jest.fn(() => chain),
    findById: jest.fn(() => chain),
    estimatedDocumentCount: jest.fn(() => ({ exec: () => Promise.resolve(1) })),
    updateOne: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
    deleteOne: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
  } as unknown as Model<never>;
}

const UID = '507f1f77bcf86cd799439011';

const CATALOG: Doc[] = [
  {
    _id: 'r1',
    title: 'CSS Flexbox Froggy',
    description: 'Learn flexbox by playing.',
    provider: 'Codepip',
    kind: 'practice',
    topics: ['css', 'flexbox', 'frontend'],
    level: 'beginner',
    minutes: 45,
    free: true,
    quality: 85,
  },
  {
    _id: 'r2',
    title: 'System Design Primer',
    description: 'Scalability, caching, sharding.',
    provider: 'GitHub',
    kind: 'book',
    topics: ['system-design', 'architecture', 'interview'],
    level: 'advanced',
    minutes: 2400,
    free: true,
    quality: 94,
  },
  {
    _id: 'r3',
    title: 'React — Official Learn React',
    description: 'Components, state, effects.',
    provider: 'React',
    kind: 'docs',
    topics: ['react', 'frontend', 'mern'],
    level: 'beginner',
    minutes: 900,
    free: true,
    quality: 94,
  },
];

function build(profile: Doc | null, roadmap: Doc | null = null) {
  const resources = fakeModel(CATALOG);
  const progress = fakeModel([]);
  const roadmaps = fakeModel(roadmap);
  const profiles = {
    findByUser: jest.fn().mockResolvedValue(profile),
  } as unknown as StudentProfileService;
  return new ResourcesService(
    resources as never,
    progress as never,
    roadmaps as never,
    profiles,
  );
}

describe('ResourcesService.forYou', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('weak areas outrank goal matches and say why', async () => {
    const svc = build({
      mainGoal: 'Become a MERN stack developer',
      currentSkills: ['javascript'],
      weakAreas: ['CSS flexbox'],
      currentSkillLevel: 'beginner',
    });
    const picks = await svc.forYou(UID);
    expect(picks[0].title).toContain('Flexbox');
    expect(picks[0].reason).toContain('weak area');
    // The MERN/React resource matches the goal.
    const react = picks.find((p) => p.title.includes('React'));
    expect(react?.reason).toContain('goal');
  });

  it("the active roadmap week's focus boosts matching resources", async () => {
    const svc = build(
      { mainGoal: 'Backend engineer', currentSkills: [], weakAreas: [] },
      {
        goal: 'Backend engineer',
        weeklyPlan: [{ weekNumber: 1, focus: 'System design basics' }],
        completedWeeks: [],
      },
    );
    const picks = await svc.forYou(UID);
    const primer = picks.find((p) => p.title.includes('System Design'));
    expect(primer).toBeTruthy();
    expect(primer?.reason).toContain("week's focus");
  });

  it('no profile signal → no fabricated recommendations', async () => {
    const svc = build(null);
    const picks = await svc.forYou(UID);
    expect(picks).toEqual([]);
  });
});
