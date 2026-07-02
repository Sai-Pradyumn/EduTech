import { Logger } from '@nestjs/common';
import { ChatCommandRegistryService } from '../agents/core/chat-command-registry.service';
import { ContextEngineService } from '../agents/core/context-engine.service';
import { MemoryChatCommands } from './memory-chat-commands';
import { MemoryService } from './memory.service';

/**
 * "remember/forget" must really change memory and confirm honestly —
 * naming exactly what was saved/deleted, and never writing on questions.
 */

function build(over: Partial<Record<string, unknown>> = {}) {
  const memory = {
    rememberFact: jest.fn().mockResolvedValue({ id: 'm1' }),
    forgetMatching: jest
      .fn()
      .mockResolvedValue(
        'deleted' in over ? over.deleted : 'prefers visual explanations',
      ),
  };

  const contextEngine = {
    invalidate: jest.fn(),
  } as unknown as ContextEngineService & { invalidate: jest.Mock };
  const registry = new ChatCommandRegistryService(contextEngine);
  new MemoryChatCommands(
    registry,
    memory as unknown as MemoryService,
  ).onModuleInit();
  return { registry, memory, contextEngine };
}

describe('MemoryChatCommands', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('"remember that I prefer video lessons" really saves', async () => {
    const { registry, memory, contextEngine } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'remember that I prefer video lessons',
    );
    expect(memory.rememberFact).toHaveBeenCalledWith(
      'u1',
      '',
      'I prefer video lessons',
    );
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('I prefer video lessons');
    // The very next turn must see the new memory.
    expect(contextEngine.invalidate).toHaveBeenCalledWith('u1');
  });

  it('"forget my language preference" deletes and names the victim verbatim', async () => {
    const { registry, memory } = build({ deleted: 'prefers Hindi replies' });
    const [r] = await registry.detectAndExecute(
      'u1',
      'forget my language preference',
    );
    expect(memory.forgetMatching).toHaveBeenCalledWith(
      'u1',
      '',
      'my language preference',
    );
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('prefers Hindi replies');
  });

  it('no match → honest "nothing was deleted"', async () => {
    const { registry } = build({ deleted: null });
    const [r] = await registry.detectAndExecute('u1', 'forget quantum physics');
    expect(r.ok).toBe(false);
    expect(r.summary).toContain('nothing was deleted');
  });

  it('questions never write', async () => {
    const { registry, memory } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'do you remember that I prefer video lessons?',
    );
    expect(results).toEqual([]);
    expect(memory.rememberFact).not.toHaveBeenCalled();
    expect(memory.forgetMatching).not.toHaveBeenCalled();
  });

  it('mid-sentence mentions of remember/forget do not trigger', async () => {
    const { registry, memory } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'I always forget recursion base cases when coding',
    );
    expect(results).toEqual([]);
    expect(memory.forgetMatching).not.toHaveBeenCalled();
  });
});
