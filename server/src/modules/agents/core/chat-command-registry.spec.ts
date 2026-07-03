import { Logger } from '@nestjs/common';
import { ChatCommandRegistryService } from './chat-command-registry.service';
import { ContextEngineService } from './context-engine.service';

/**
 * The registry attaches an invalidation receipt to every successful write so the
 * client can refresh the right screens. These guard the namespace→domains mapping
 * and its precedence rules.
 */
function make(): ChatCommandRegistryService {
  const ctx = { invalidate: jest.fn() } as unknown as ContextEngineService;
  return new ChatCommandRegistryService(ctx);
}

describe('ChatCommandRegistryService — invalidation receipts', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('defaults `affects` from the command namespace (roadmap.* → roadmap/dashboard/intelligence)', async () => {
    const reg = make();
    reg.register({
      name: 'roadmap.test',
      description: 'x',
      match: () => ({}),
      execute: () => Promise.resolve({ ok: true, summary: 'done' }),
    });
    const [r] = await reg.detectAndExecute('u1', 'do it');
    expect(r.affects).toEqual(['roadmap', 'dashboard', 'intelligence']);
  });

  it('daily_plan.* maps to dailyPlan/dashboard (a direct edit → reload, not regenerate)', async () => {
    const reg = make();
    reg.register({
      name: 'daily_plan.test',
      description: 'x',
      match: () => ({}),
      execute: () => Promise.resolve({ ok: true, summary: 'done' }),
    });
    const [r] = await reg.detectAndExecute('u1', 'do it');
    expect(r.affects).toEqual(['dailyPlan', 'dashboard']);
  });

  it('an explicit `affects` on the result wins over the namespace default', async () => {
    const reg = make();
    reg.register({
      name: 'roadmap.test',
      description: 'x',
      match: () => ({}),
      execute: () =>
        Promise.resolve({ ok: true, summary: 'done', affects: ['ledger'] }),
    });
    const [r] = await reg.detectAndExecute('u1', 'do it');
    expect(r.affects).toEqual(['ledger']);
  });

  it('a failed command carries no receipt (nothing changed → nothing to refresh)', async () => {
    const reg = make();
    reg.register({
      name: 'roadmap.test',
      description: 'x',
      match: () => ({}),
      execute: () => Promise.resolve({ ok: false, summary: 'could not' }),
    });
    const [r] = await reg.detectAndExecute('u1', 'do it');
    expect(r.affects).toBeUndefined();
  });
});
