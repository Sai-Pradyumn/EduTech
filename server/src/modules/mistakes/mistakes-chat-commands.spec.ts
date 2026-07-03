import { Logger } from '@nestjs/common';
import { ChatCommandRegistryService } from '../agents/core/chat-command-registry.service';
import { ContextEngineService } from '../agents/core/context-engine.service';
import { MistakesChatCommands } from './mistakes-chat-commands';
import { MistakesService } from './mistakes.service';

/** Saying "I keep getting X wrong" must log a real, reviewable mistake — and
 *  questions must never write. Review/repair commands stay read-only routes. */
function build() {
  const service = {
    captureManual: jest
      .fn()
      .mockImplementation((_u: string, dto: { concept: string }) =>
        Promise.resolve({ concept: dto.concept, severity: 60 }),
      ),
    list: jest.fn().mockResolvedValue([]),
    due: jest.fn().mockResolvedValue([]),
  };
  const contextEngine = {
    invalidate: jest.fn(),
  } as unknown as ContextEngineService & { invalidate: jest.Mock };
  const registry = new ChatCommandRegistryService(contextEngine);
  new MistakesChatCommands(
    registry,
    service as unknown as MistakesService,
  ).onModuleInit();
  return { registry, service };
}

describe('MistakesChatCommands — log', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('"I keep getting recursion wrong" logs a real mistake', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'I keep getting recursion wrong',
    );
    expect(service.captureManual).toHaveBeenCalledWith('u1', {
      concept: 'recursion',
    });
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('recursion');
    expect(r.route).toBe('/app/mistakes');
    expect(r.affects).toEqual(['mistakes', 'dashboard', 'intelligence']);
  });

  it('"log a mistake: async/await" captures the concept', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'log a mistake: async/await',
    );
    expect(service.captureManual).toHaveBeenCalledWith('u1', {
      concept: 'async/await',
    });
    expect(r.ok).toBe(true);
  });

  it('"I struggle with closures" captures it (strips the filler lead)', async () => {
    const { registry, service } = build();
    await registry.detectAndExecute('u1', 'I struggle with closures');
    expect(service.captureManual).toHaveBeenCalledWith('u1', {
      concept: 'closures',
    });
  });

  it('a question never logs ("what am I getting wrong?")', async () => {
    const { registry, service } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'what am I getting wrong?',
    );
    expect(results).toEqual([]);
    expect(service.captureManual).not.toHaveBeenCalled();
  });

  it('"start my review" stays a read-only route (does not log)', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute('u1', 'start my review');
    expect(service.captureManual).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.route).toContain('/app/mistakes');
  });
});
