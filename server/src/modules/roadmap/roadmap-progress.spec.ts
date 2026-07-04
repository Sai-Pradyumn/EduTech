import { RoadmapService } from './roadmap.service';

/**
 * Progress must be task-aware: ticking individual tasks inside a week moves the bar,
 * rather than only jumping when a whole week is marked complete (ROAD-BUG-001). Each
 * week carries an equal share of the plan.
 */
type Week = { weekNumber: number; tasks: string[] };
function roadmap(
  weeklyPlan: Week[],
  completedWeeks: number[] = [],
  completedTasks: string[] = [],
) {
  return { weeklyPlan, completedWeeks, completedTasks };
}

function progressOf(r: ReturnType<typeof roadmap>): number {
  const svc = new RoadmapService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return (
    svc as unknown as { computeProgress(r: unknown): number }
  ).computeProgress(r);
}

describe('RoadmapService.computeProgress', () => {
  const weeks: Week[] = [
    { weekNumber: 1, tasks: ['a', 'b', 'c', 'd'] },
    { weekNumber: 2, tasks: ['a', 'b'] },
  ];

  it('is 0 with no progress and 0 for an empty plan', () => {
    expect(progressOf(roadmap(weeks))).toBe(0);
    expect(progressOf(roadmap([]))).toBe(0);
  });

  it('moves on partial task completion within a week', () => {
    // 2 of week 1's 4 tasks = half of week 1 = 25% across two equal weeks.
    expect(progressOf(roadmap(weeks, [], ['w1:t0', 'w1:t1']))).toBe(25);
  });

  it('gives a fully-checked week full credit even if never marked complete', () => {
    expect(progressOf(roadmap(weeks, [], ['w2:t0', 'w2:t1']))).toBe(50);
  });

  it('counts an explicitly completed week as its full share', () => {
    expect(progressOf(roadmap(weeks, [1], []))).toBe(50);
  });

  it('is 100 when every week is complete', () => {
    expect(progressOf(roadmap(weeks, [1, 2], []))).toBe(100);
  });

  it('falls back to whole-week weighting when no week has tasks', () => {
    const noTasks: Week[] = [
      { weekNumber: 1, tasks: [] },
      { weekNumber: 2, tasks: [] },
    ];
    expect(progressOf(roadmap(noTasks, [1], []))).toBe(50);
  });
});
