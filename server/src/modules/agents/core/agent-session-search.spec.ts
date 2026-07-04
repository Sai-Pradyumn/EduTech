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

describe('AgentSessionService truncateAfter', () => {
  const userId = new Types.ObjectId().toHexString();
  const sid = new Types.ObjectId();
  const anchorId = new Types.ObjectId();

  function exec<T>(v: T) {
    return { exec: jest.fn().mockResolvedValue(v) };
  }

  function svc(opts: { session?: unknown; anchor?: unknown } = {}) {
    const save = jest.fn().mockResolvedValue(undefined);
    const sessionDoc = 'session' in opts ? opts.session : { _id: sid, save };
    const sessions = { findOne: jest.fn().mockReturnValue(exec(sessionDoc)) };
    const deleteMany = jest.fn().mockReturnValue(exec({ deletedCount: 2 }));
    const findChain = {
      sort: jest.fn(),
      limit: jest.fn(),
      exec: jest.fn().mockResolvedValue([]),
    };
    findChain.sort.mockReturnValue(findChain);
    findChain.limit.mockReturnValue(findChain);
    const messages = {
      findOne: jest.fn().mockReturnValue(exec(opts.anchor ?? null)),
      deleteMany,
      find: jest.fn().mockReturnValue(findChain),
      countDocuments: jest.fn().mockReturnValue(exec(3)),
    };
    const service = new AgentSessionService(
      sessions as never,
      messages as never,
      { isLive: false } as never,
    );
    return { service, sessions, messages, deleteMany };
  }

  it('with an anchor, deletes only messages created after it', async () => {
    const anchorAt = new Date('2026-07-01');
    const { service, deleteMany } = svc({
      anchor: { _id: anchorId, createdAt: anchorAt },
    });
    const r = await service.truncateAfter(
      userId,
      sid.toHexString(),
      anchorId.toHexString(),
    );
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ createdAt: { $gt: anchorAt } }),
    );
    expect(r).toEqual({ ok: true, kept: 3 });
  });

  it('with no anchor, clears the whole branch', async () => {
    const { service, deleteMany } = svc();
    await service.truncateAfter(userId, sid.toHexString());
    const calls = deleteMany.mock.calls as unknown as Record<
      string,
      unknown
    >[][];
    expect(calls[0][0]['createdAt']).toBeUndefined();
  });

  it("rejects a session that is not the owner's", async () => {
    const { service } = svc({ session: null });
    await expect(
      service.truncateAfter(userId, sid.toHexString()),
    ).rejects.toThrow();
  });

  it('is a no-op for an invalid session id', async () => {
    const { service, sessions } = svc();
    expect(await service.truncateAfter(userId, 'not-an-id')).toEqual({
      ok: true,
      kept: 0,
    });
    expect(sessions.findOne).not.toHaveBeenCalled();
  });
});
