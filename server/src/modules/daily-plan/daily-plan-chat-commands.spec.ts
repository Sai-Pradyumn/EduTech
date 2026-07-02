import { Logger } from '@nestjs/common';
import { ChatCommandRegistryService } from '../agents/core/chat-command-registry.service';
import { ContextEngineService } from '../agents/core/context-engine.service';
import { DailyPlanChatCommands } from './daily-plan-chat-commands';
import { DailyPlanService } from './daily-plan.service';

/** Plan items must be really checked off / added from chat, honestly confirmed. */

function plan(over: Partial<Record<string, unknown>> = {}) {
  return {
    items: [
      { id: 'i1', title: 'Revise recursion', done: false, estimateMinutes: 20 },
      { id: 'i2', title: 'Quiz: arrays', done: false, estimateMinutes: 15 },
    ],
    totalMinutes: 35,
    ...over,
  };
}

function build(over: Partial<Record<string, unknown>> = {}) {
  const today = over.plan ?? plan();
  const service = {
    getToday: jest.fn().mockResolvedValue(today),
    completeItem: jest.fn().mockImplementation((_u: string, itemId: string) =>
      Promise.resolve(
        plan({
          items: plan().items.map((i) =>
            i.id === itemId ? { ...i, done: true } : i,
          ),
        }),
      ),
    ),
    addItem: jest
      .fn()
      .mockImplementation((_u: string, title: string, minutes: number) =>
        Promise.resolve(
          plan({
            items: [
              ...plan().items,
              { id: 'i3', title, done: false, estimateMinutes: minutes },
            ],
            totalMinutes: 35 + minutes,
          }),
        ),
      ),
  };
  const contextEngine = {
    invalidate: jest.fn(),
  } as unknown as ContextEngineService & { invalidate: jest.Mock };
  const registry = new ChatCommandRegistryService(contextEngine);
  new DailyPlanChatCommands(
    registry,
    service as unknown as DailyPlanService,
  ).onModuleInit();
  return { registry, service };
}

describe('DailyPlanChatCommands', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('"check off revise recursion" really toggles the matching item', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'check off revise recursion',
    );
    expect(service.completeItem).toHaveBeenCalledWith('u1', 'i1');
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('Revise recursion');
    expect(r.summary).toContain('1/2 done');
    // completeItem toggles → the same command is its own undo.
    expect(r.undo?.text).toBe('check off Revise recursion');
  });

  it('the explicit form: "mark quiz: arrays as done on my plan"', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      "mark 'quiz: arrays' as done on my plan",
    );
    expect(service.completeItem).toHaveBeenCalledWith('u1', 'i2');
    expect(r.ok).toBe(true);
  });

  it('"add 30 min of system design to my plan" appends a real item', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'add 30 min of system design to my plan',
    );
    expect(service.addItem).toHaveBeenCalledWith('u1', 'system design', 30);
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('system design');
    expect(r.summary).toContain('3 items');
  });

  it('no matching item → honest failure, nothing toggled', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'check off quantum physics',
    );
    expect(r.ok).toBe(false);
    expect(service.completeItem).not.toHaveBeenCalled();
  });

  it('questions never write', async () => {
    const { registry, service } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'should I check off revise recursion?',
    );
    expect(results).toEqual([]);
    expect(service.completeItem).not.toHaveBeenCalled();
  });
});
