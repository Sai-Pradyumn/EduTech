import { Types } from 'mongoose';
import { AgentSessionService } from './agent-session.service';

/**
 * Cross-session search + pinning — hermetic (fake models, no DB, no AI).
 */
describe('AgentSessionService search & pin', () => {
  const userId = new Types.ObjectId().toHexString();
  const sidA = new Types.ObjectId();
  const sidB = new Types.ObjectId();

  function query<T>(result: T) {
    const obj = {
      sort: jest.fn(),
      limit: jest.fn(),
      lean: jest.fn(),
      exec: jest.fn().mockResolvedValue(result),
    };
    obj.sort.mockReturnValue(obj);
    obj.limit.mockReturnValue(obj);
    obj.lean.mockReturnValue(obj);
    return obj;
  }

  function build(opts: {
    msgs?: unknown[];
    titled?: unknown[];
    sessionDocs?: unknown[];
    matched?: number;
  }) {
    const sessions = {
      find: jest.fn().mockImplementation((filter: Record<string, unknown>) => {
        if ('title' in filter) return query(opts.titled ?? []);
        return query(opts.sessionDocs ?? []);
      }),
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: opts.matched ?? 1 }),
      }),
    };
    const messages = {
      find: jest.fn().mockReturnValue(query(opts.msgs ?? [])),
    };
    const service = new AgentSessionService(
      sessions as never,
      messages as never,
      { isLive: false } as never,
    );
    return { service, sessions, messages };
  }

  it('returns one hit per session with a snippet centred on the match', async () => {
    const { service } = build({
      msgs: [
        {
          session: sidA,
          content:
            'Today we went deep on closures in JavaScript and scope chains.',
          createdAt: new Date('2026-07-01'),
        },
        {
          session: sidA, // older hit in the same session must be ignored
          content: 'closures again',
          createdAt: new Date('2026-06-20'),
        },
      ],
      sessionDocs: [
        {
          _id: sidA,
          title: 'JS deep dive',
          agentType: 'tutor',
          lastMessageAt: new Date('2026-07-01'),
        },
      ],
    });

    const hits = await service.searchSessions(userId, 'closures');
    expect(hits).toHaveLength(1);
    expect(hits[0].sessionId).toBe(String(sidA));
    expect(hits[0].title).toBe('JS deep dive');
    expect(hits[0].snippet).toContain('closures');
  });

  it('includes title-only matches with an empty snippet', async () => {
    const { service } = build({
      msgs: [],
      titled: [
        {
          _id: sidB,
          title: 'GraphQL basics',
          agentType: 'tutor',
          lastMessageAt: new Date('2026-06-28'),
        },
      ],
      sessionDocs: [
        {
          _id: sidB,
          title: 'GraphQL basics',
          agentType: 'tutor',
          lastMessageAt: new Date('2026-06-28'),
        },
      ],
    });

    const hits = await service.searchSessions(userId, 'graphql');
    expect(hits).toHaveLength(1);
    expect(hits[0].snippet).toBe('');
  });

  it('rejects queries under 2 characters without touching the DB', async () => {
    const { service, messages } = build({});
    expect(await service.searchSessions(userId, ' x ')).toEqual([]);
    expect(messages.find).not.toHaveBeenCalled();
  });

  it('setPinned scopes the update to the owner and reports a miss honestly', async () => {
    const { service, sessions } = build({ matched: 1 });
    const sid = new Types.ObjectId().toHexString();
    expect(await service.setPinned(userId, sid, true)).toBe(true);
    expect(sessions.updateOne).toHaveBeenCalledWith(
      { _id: sid, user: new Types.ObjectId(userId) },
      { $set: { pinned: true } },
    );

    const miss = build({ matched: 0 });
    expect(await miss.service.setPinned(userId, sid, false)).toBe(false);

    const invalid = build({});
    expect(await invalid.service.setPinned(userId, 'not-an-id', true)).toBe(
      false,
    );
    expect(invalid.sessions.updateOne).not.toHaveBeenCalled();
  });
});
