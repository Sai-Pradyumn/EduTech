import { ChatCommandSuggestService } from './chat-command-suggest.service';

/**
 * "Did you mean" suggester — the safety contract matters more than recall:
 * suggestions only exist when live, only for imperative near-misses, and only
 * when the rewritten text would really match a deterministic matcher.
 */
describe('ChatCommandSuggestService', () => {
  function build(opts: {
    live?: boolean;
    suggestion?: string;
    wouldMatch?: boolean;
    fail?: boolean;
  }) {
    const registry = {
      list: jest.fn().mockReturnValue([
        {
          name: 'roadmap.mark_week_complete',
          description: 'Mark a roadmap week as complete',
          examples: ['mark week 2 as complete'],
        },
      ]),
      wouldMatch: jest.fn().mockReturnValue(opts.wouldMatch ?? true),
    };
    const ai = {
      isLive: opts.live ?? true,
      generateStructuredOutput: opts.fail
        ? jest.fn().mockRejectedValue(new Error('provider down'))
        : jest.fn().mockResolvedValue({ suggestion: opts.suggestion ?? '' }),
    };
    const service = new ChatCommandSuggestService(
      registry as never,
      ai as never,
    );
    return { service, registry, ai };
  }

  it('suggests a canonical phrasing for an imperative near-miss', async () => {
    const { service, registry } = build({
      suggestion: 'mark week 2 as complete',
    });
    const out = await service.suggest(
      'u1',
      'set my second week to finished pls',
    );
    expect(out).toBe('mark week 2 as complete');
    expect(registry.wouldMatch).toHaveBeenCalledWith('mark week 2 as complete');
  });

  it('drops suggestions that no deterministic matcher would accept', async () => {
    const { service } = build({
      suggestion: 'delete my account',
      wouldMatch: false,
    });
    expect(
      await service.suggest('u1', 'complete my second week now'),
    ).toBeNull();
  });

  it('never fires offline, for questions, or for non-imperative chatter', async () => {
    const offline = build({ live: false });
    expect(
      await offline.service.suggest('u1', 'mark my second week finished'),
    ).toBeNull();
    expect(offline.ai.generateStructuredOutput).not.toHaveBeenCalled();

    const { service, ai } = build({});
    expect(
      await service.suggest('u1', 'can you mark week 2 complete?'),
    ).toBeNull();
    expect(
      await service.suggest('u1', 'closures are confusing to me today'),
    ).toBeNull();
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled();
  });

  it('degrades to null on provider failure or empty suggestion', async () => {
    const failing = build({ fail: true });
    expect(
      await failing.service.suggest('u1', 'complete my second week now'),
    ).toBeNull();

    const empty = build({ suggestion: '' });
    expect(
      await empty.service.suggest('u1', 'complete my second week now'),
    ).toBeNull();
    expect(empty.registry.wouldMatch).not.toHaveBeenCalled();
  });
});
