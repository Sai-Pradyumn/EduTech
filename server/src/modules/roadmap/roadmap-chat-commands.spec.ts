import { Logger } from '@nestjs/common';
import { ChatCommandRegistryService } from '../agents/core/chat-command-registry.service';
import { ContextEngineService } from '../agents/core/context-engine.service';
import { RoadmapChatCommands } from './roadmap-chat-commands';
import { RoadmapService } from './roadmap.service';

/**
 * Saying it in chat must REALLY update the roadmap — and questions must never
 * write. Covers the exact learner phrasings the feature was built for.
 */

function activeRoadmap(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    title: 'Java Backend Path',
    weeklyPlan: [
      {
        weekNumber: 1,
        title: 'Programming fundamentals',
        focus: 'Java fundamentals',
        topics: ['syntax', 'oop'],
        tasks: ['a', 'b'],
      },
      {
        weekNumber: 2,
        title: 'Collections',
        focus: 'Collections and generics',
        topics: ['lists', 'maps'],
        tasks: ['a'],
      },
      {
        weekNumber: 3,
        title: 'Persistence',
        focus: 'Databases with JPA',
        topics: ['sql', 'jpa'],
        tasks: ['a'],
      },
    ],
    completedWeeks: [],
    progressPercentage: 0,
    ...over,
  };
}

function build(over: Partial<Record<string, unknown>> = {}) {
  const roadmap = over.roadmap === undefined ? activeRoadmap() : over.roadmap;
  const service = {
    findActive: jest.fn().mockResolvedValue(roadmap),
    updateProgress: jest
      .fn()
      .mockImplementation(
        (
          _u: string,
          _id: string,
          dto: { weekNumber: number; weekCompleted: boolean },
        ) =>
          Promise.resolve(
            activeRoadmap({
              completedWeeks: dto.weekCompleted ? [dto.weekNumber] : [],
              progressPercentage: dto.weekCompleted ? 33 : 0,
            }),
          ),
      ),
    regenerateWeek: jest
      .fn()
      .mockImplementation(
        (_u: string, _id: string, weekNumber: number, note: string) =>
          Promise.resolve(
            activeRoadmap({
              weeklyPlan: activeRoadmap().weeklyPlan.map((w) =>
                w.weekNumber === weekNumber ? { ...w, focus: note } : w,
              ),
            }),
          ),
      ),
    restoreVersion: jest
      .fn()
      .mockResolvedValue(activeRoadmap({ progressPercentage: 33 })),
  };

  const contextEngine = {
    invalidate: jest.fn(),
  } as unknown as ContextEngineService & { invalidate: jest.Mock };
  const registry = new ChatCommandRegistryService(contextEngine);
  new RoadmapChatCommands(
    registry,
    service as unknown as RoadmapService,
  ).onModuleInit();
  return { registry, service, contextEngine };
}

describe('RoadmapChatCommands', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('"mark week 2 as complete" really updates progress', async () => {
    const { registry, service, contextEngine } = build();
    const [result] = await registry.detectAndExecute(
      'u1',
      'mark week 2 as complete',
    );
    expect(service.updateProgress).toHaveBeenCalledWith('u1', 'r1', {
      weekNumber: 2,
      weekCompleted: true,
    });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Week 2');
    expect(result.summary).toContain('Collections');
    expect(result.route).toBe('/app/roadmap/r1');
    // The same turn must see the new state.
    expect(contextEngine.invalidate).toHaveBeenCalledWith('u1');
  });

  it('the real learner phrasing: topic mark + typo + next flow', async () => {
    const { registry, service } = build();
    const [result] = await registry.detectAndExecute(
      'u1',
      'mark the fundamentals as completed - i have already masterd it, i want to go to next flow',
    );
    // "fundamentals" resolves to Week 1 by lexical match on title/focus.
    expect(service.updateProgress).toHaveBeenCalledWith('u1', 'r1', {
      weekNumber: 1,
      weekCompleted: true,
    });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Next up: Week 2');
  });

  it('"move me to the next week" completes the current week', async () => {
    const { registry, service } = build({
      roadmap: activeRoadmap({ completedWeeks: [1] }),
    });
    const [result] = await registry.detectAndExecute(
      'u1',
      'move me to the next week please',
    );
    expect(service.updateProgress).toHaveBeenCalledWith('u1', 'r1', {
      weekNumber: 2,
      weekCompleted: true,
    });
    expect(result.ok).toBe(true);
  });

  it('"change week 3 to focus on system design" regenerates that week', async () => {
    const { registry, service } = build();
    const [result] = await registry.detectAndExecute(
      'u1',
      'change week 3 to focus on system design',
    );
    expect(service.regenerateWeek).toHaveBeenCalledWith(
      'u1',
      'r1',
      3,
      'system design',
    );
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('system design');
    expect(result.summary).toContain('version');
  });

  it('"modify my roadmap to focus on interviews" reworks the CURRENT week', async () => {
    const { registry, service } = build({
      roadmap: activeRoadmap({ completedWeeks: [1] }),
    });
    await registry.detectAndExecute(
      'u1',
      'modify my roadmap to focus on interview preparation',
    );
    expect(service.regenerateWeek).toHaveBeenCalledWith(
      'u1',
      'r1',
      2,
      'interview preparation',
    );
  });

  it('"restore my roadmap to version 2" restores it', async () => {
    const { registry, service } = build();
    const [result] = await registry.detectAndExecute(
      'u1',
      'restore my roadmap to version 2',
    );
    expect(service.restoreVersion).toHaveBeenCalledWith('u1', 'r1', 2);
    expect(result.ok).toBe(true);
  });

  it('questions NEVER write ("how do I mark week 2 as complete?")', async () => {
    const { registry, service } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'how do I mark week 2 as complete?',
    );
    expect(results).toEqual([]);
    expect(service.updateProgress).not.toHaveBeenCalled();
  });

  it('plain explanations never write ("what should I do next")', async () => {
    const { registry, service } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'what should I do next on my roadmap',
    );
    expect(results).toEqual([]);
    expect(service.updateProgress).not.toHaveBeenCalled();
  });

  it('no active roadmap → honest failure + route to generate', async () => {
    const { registry } = build({ roadmap: null });
    const [result] = await registry.detectAndExecute(
      'u1',
      'mark week 2 as done',
    );
    expect(result.ok).toBe(false);
    expect(result.route).toBe('/app/roadmap/generate');
  });

  it('unresolvable topic → honest failure, nothing changed', async () => {
    const { registry, service } = build();
    const [result] = await registry.detectAndExecute(
      'u1',
      'mark quantum entanglement as complete',
    );
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('quantum entanglement');
    expect(service.updateProgress).not.toHaveBeenCalled();
  });

  it('a service failure degrades to an honest error, never a failed turn', async () => {
    const { registry, service } = build();
    service.updateProgress.mockRejectedValueOnce(new Error('db down'));
    const [result] = await registry.detectAndExecute(
      'u1',
      'mark week 2 as complete',
    );
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('nothing was changed');
  });
});
