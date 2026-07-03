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

  it('runs one command PER clause in a compound message', async () => {
    const reg = make();
    const calls: string[] = [];
    reg.register({
      name: 'roadmap.a',
      description: 'x',
      match: (m) => (/week 2/.test(m) ? {} : null),
      execute: () => {
        calls.push('a');
        return Promise.resolve({ ok: true, summary: 'A' });
      },
    });
    reg.register({
      name: 'mistakes.b',
      description: 'x',
      match: (m) => (/recursion/.test(m) ? {} : null),
      execute: () => {
        calls.push('b');
        return Promise.resolve({ ok: true, summary: 'B' });
      },
    });
    const results = await reg.detectAndExecute(
      'u1',
      'mark week 2 complete; recursion is still hard',
    );
    expect(calls).toEqual(['a', 'b']);
    expect(results.map((r) => r.summary)).toEqual(['A', 'B']);
  });

  it('a bare "and" inside one clause is NOT split apart', async () => {
    const reg = make();
    const seen: string[] = [];
    reg.register({
      name: 'flows.x',
      description: 'x',
      match: (m) => {
        seen.push(m);
        return /async and await/.test(m) ? {} : null;
      },
      execute: () => Promise.resolve({ ok: true, summary: 'X' }),
    });
    const results = await reg.detectAndExecute(
      'u1',
      "mark 'async and await' complete in my flow",
    );
    expect(results).toHaveLength(1);
    expect(seen.some((s) => s.includes('async and await'))).toBe(true);
  });

  it('the same command never runs twice across clauses', async () => {
    const reg = make();
    let n = 0;
    reg.register({
      name: 'roadmap.a',
      description: 'x',
      match: () => ({}),
      execute: () => {
        n++;
        return Promise.resolve({ ok: true, summary: 'A' });
      },
    });
    const results = await reg.detectAndExecute('u1', 'do this; do that');
    expect(n).toBe(1);
    expect(results).toHaveLength(1);
  });
});
