import { Logger } from '@nestjs/common';
import {
  CareerTarget,
  LearningStyle,
  SkillLevel,
  TargetTimeline,
  TimePerDay,
} from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { RoadmapAgentService } from './roadmap-agent.service';
import { RoadmapBlueprintInput } from './roadmap-blueprint.generator';

/**
 * The roadmap agent must hand persistence the EXACT Mongoose shape no matter what
 * the model returns: recoverable drift is coerced, garbage falls back to the
 * deterministic blueprint. Reproduces the production ValidationError (bare-string
 * milestones/projects/assessments, object dailyStudyPlan entries, weeks missing
 * weekNumber/title/focus) and proves it can never reach the DB again.
 */

const INPUT: RoadmapBlueprintInput = {
  fullName: 'Test Student',
  mainGoal: 'become a Java backend developer',
  currentSkillLevel: SkillLevel.Beginner,
  currentSkills: ['java basics'],
  weakAreas: ['system design'],
  availableTimePerDay: TimePerDay.OneHour,
  targetTimeline: TargetTimeline.ThreeMonths,
  preferredLearningStyle: LearningStyle.Practice,
  careerTarget: CareerTarget.FullTime,
};

/** Drifted-but-recoverable output: valid weeks, everything else malformed. */
const DRIFTED = {
  title: 'Java Backend Roadmap',
  goal: 'become a Java backend developer',
  overview: 'A practical path to backend readiness.',
  weeklyPlan: [
    {
      weekNumber: 7, // wrong numbering — must be renumbered
      title: 'Java fundamentals',
      focus: 'Syntax, OOP, collections',
      topics: ['classes', 'interfaces'],
      tasks: ['Build a CLI tool'],
    },
    {
      weekNumber: 7, // duplicate
      title: 'Persistence',
      focus: 'JDBC and JPA',
      topics: ['jdbc', 'jpa'],
      tasks: ['Wire a Postgres repo'],
    },
  ],
  milestones: ['Complete Java basics course'], // bare string
  recommendedProjects: ['Command-line calculator'], // bare string
  assessmentPlan: ['Peer review of project'], // bare string
  dailyStudyPlan: [
    { day: 1, topic: 'Java basics', tasks: ['Watch tutorial', 'Practice'] },
    'Day 2: review collections',
  ],
  successTips: ['Code every day'],
};

function agent(output: unknown) {
  const ai = {
    isLive: true,
    generateStructuredOutput: jest.fn().mockResolvedValue(output),
    logUsage: jest.fn().mockResolvedValue(undefined),
  } as unknown as AiService & { generateStructuredOutput: jest.Mock };
  return { agent: new RoadmapAgentService(ai), ai };
}

describe('RoadmapAgentService.generate — persistence-safe output', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('coerces recoverable drift into the exact Mongoose shape', async () => {
    const { agent: svc } = agent(DRIFTED);
    const r = await svc.generate('u1', INPUT);

    // Weeks renumbered sequentially, content preserved.
    expect(r.weeklyPlan.map((w) => w.weekNumber)).toEqual([1, 2]);
    expect(r.weeklyPlan[1].focus).toBe('JDBC and JPA');

    // Bare strings became real objects — the production crash shape.
    expect(r.milestones[0]).toEqual({
      title: 'Complete Java basics course',
      description: '',
      targetWeek: 2,
      completionCriteria: [],
    });
    expect(r.recommendedProjects[0].title).toBe('Command-line calculator');
    expect(typeof r.recommendedProjects[0]).toBe('object');
    expect(r.assessmentPlan[0].title).toBe('Peer review of project');
    expect(r.assessmentPlan[0].type).toBe('quiz');
    expect(r.assessmentPlan[0].week).toBeLessThanOrEqual(r.weeklyPlan.length);

    // Object daily entries rendered to honest strings.
    expect(r.dailyStudyPlan[0]).toBe(
      'Day 1 — Java basics — Watch tutorial; Practice',
    );
    expect(r.dailyStudyPlan[1]).toBe('Day 2: review collections');
    expect(r.dailyStudyPlan.every((d) => typeof d === 'string')).toBe(true);
  });

  it('unusable weekly core falls back to the blueprint (never an invalid save)', async () => {
    const { agent: svc } = agent({
      title: 'x',
      weeklyPlan: ['week one', 'week two'], // strings — unrecoverable
      milestones: [],
    });
    const r = await svc.generate('u1', INPUT);
    expect(r.weeklyPlan.length).toBeGreaterThanOrEqual(2);
    expect(
      r.weeklyPlan.every(
        (w) =>
          typeof w.weekNumber === 'number' &&
          w.title.length > 0 &&
          w.focus.length > 0,
      ),
    ).toBe(true);
    expect(r.milestones.length).toBeGreaterThan(0);
    expect(r.milestones.every((m) => typeof m.targetWeek === 'number')).toBe(
      true,
    );
  });

  it('a provider/contract error falls back to the blueprint', async () => {
    const { agent: svc, ai } = agent(DRIFTED);
    ai.generateStructuredOutput.mockRejectedValueOnce(
      new Error('AI output for "roadmap.generate" violated its schema'),
    );
    const r = await svc.generate('u1', INPUT);
    expect(r.weeklyPlan.length).toBeGreaterThan(0);
    expect(r.goal).toBe(INPUT.mainGoal);
  });

  it('missing milestones are synthesized, good weeks are kept', async () => {
    const { agent: svc } = agent({ ...DRIFTED, milestones: [] });
    const r = await svc.generate('u1', INPUT);
    expect(r.weeklyPlan[0].title).toBe('Java fundamentals'); // AI weeks kept
    expect(r.milestones).toHaveLength(1);
    expect(r.milestones[0].targetWeek).toBe(r.weeklyPlan.length);
  });

  it('a serialized JSON dump in dailyStudyPlan is dropped, not persisted', async () => {
    const dump = `[\n  {\n    day: 1,\n    topic: 'Java basics',\n    tasks: [ 'Watch Java tutorial videos', 'Practice coding' ]\n  },\n  {\n    day: 2,\n    topic: 'System design',\n    tasks: [ 'Read system design book' ]\n  }\n]`;
    const { agent: svc } = agent({ ...DRIFTED, dailyStudyPlan: [dump] });
    const r = await svc.generate('u1', INPUT);
    expect(r.dailyStudyPlan.some((d) => d.includes('tasks: ['))).toBe(false);
    expect(r.dailyStudyPlan.length).toBeGreaterThan(0); // blueprint filled in
  });
});
