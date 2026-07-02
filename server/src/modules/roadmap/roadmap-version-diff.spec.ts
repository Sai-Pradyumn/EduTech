import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RoadmapService } from './roadmap.service';

/**
 * diffVersion — the read-only "what would restoring change?" preview.
 * Hermetic: fake Mongoose models, no DB.
 */
describe('RoadmapService.diffVersion', () => {
  const userId = new Types.ObjectId().toHexString();
  const roadmapId = new Types.ObjectId().toHexString();

  const week = (
    n: number,
    over: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> => ({
    weekNumber: n,
    title: `Week ${n}`,
    focus: `Focus ${n}`,
    topics: [`t${n}a`, `t${n}b`],
    tasks: [`task ${n}.1`, `task ${n}.2`],
    practiceItems: [],
    expectedOutcome: '',
    ...over,
  });

  const baseContent = () => ({
    title: 'Backend path',
    goal: 'Become a backend dev',
    overview: 'The plan.',
    estimatedDuration: '8 weeks',
    difficulty: 'Intermediate',
    milestones: [
      { title: 'M1', description: '', targetWeek: 2, completionCriteria: [] },
    ],
    recommendedProjects: [],
    assessmentPlan: [],
    dailyStudyPlan: [],
    successTips: [],
  });

  function build(
    current: Record<string, unknown>,
    snap: Record<string, unknown> | null,
  ) {
    const model = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: roadmapId,
          user: new Types.ObjectId(userId),
          ...current,
        }),
      }),
    };
    const versions = {
      findOne: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(snap) }),
      }),
    };
    return new RoadmapService(
      model as never,
      versions as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('detects changed weeks: focus, added topics, task-count changes', async () => {
    const current = { ...baseContent(), weeklyPlan: [week(1), week(2)] };
    const snap = {
      ...baseContent(),
      version: 1,
      label: 'Generated',
      createdAt: new Date('2026-06-01'),
      weeklyPlan: [
        week(1),
        week(2, {
          focus: 'Different focus',
          topics: ['t2a', 't2b', 'extra topic'],
          tasks: ['only one task'],
        }),
      ],
    };
    const diff = await build(current, snap).diffVersion(userId, roadmapId, 1);

    expect(diff.same).toBe(false);
    expect(diff.weeks).toHaveLength(1);
    const w2 = diff.weeks[0];
    expect(w2.weekNumber).toBe(2);
    expect(w2.kind).toBe('changed');
    expect(w2.changes.join(' ')).toContain('focus');
    expect(w2.changes.join(' ')).toContain('+1 topic');
    expect(w2.changes.join(' ')).toContain('tasks: 2 → 1');
  });

  it('marks weeks present only in the version as added, only in current as removed', async () => {
    const current = { ...baseContent(), weeklyPlan: [week(1), week(2)] };
    const snap = {
      ...baseContent(),
      version: 3,
      label: 'Week 3 added',
      createdAt: new Date(),
      weeklyPlan: [week(1), week(3)],
    };
    const diff = await build(current, snap).diffVersion(userId, roadmapId, 3);

    expect(diff.weeks.map((w) => [w.weekNumber, w.kind])).toEqual([
      [2, 'removed'],
      [3, 'added'],
    ]);
  });

  it('reports identical content as same with no entries', async () => {
    const plan = [week(1), week(2)];
    const current = { ...baseContent(), weeklyPlan: plan };
    const snap = {
      ...baseContent(),
      version: 2,
      label: 'Restored',
      createdAt: new Date(),
      weeklyPlan: plan,
    };
    const diff = await build(current, snap).diffVersion(userId, roadmapId, 2);

    expect(diff.same).toBe(true);
    expect(diff.fields).toEqual([]);
    expect(diff.weeks).toEqual([]);
  });

  it('surfaces top-level field and collection-size changes', async () => {
    const current = { ...baseContent(), weeklyPlan: [week(1)] };
    const snap = {
      ...baseContent(),
      title: 'Old title',
      milestones: [],
      version: 1,
      label: 'Generated',
      createdAt: new Date(),
      weeklyPlan: [week(1)],
    };
    const diff = await build(current, snap).diffVersion(userId, roadmapId, 1);

    expect(diff.fields.join(' | ')).toContain('title');
    expect(diff.fields.join(' | ')).toContain('milestones: 1 → 0');
  });

  it('404s for a version that does not exist', async () => {
    const current = { ...baseContent(), weeklyPlan: [week(1)] };
    await expect(
      build(current, null).diffVersion(userId, roadmapId, 9),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
