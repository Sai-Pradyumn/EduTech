import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MentorMarketplaceService } from './mentor-marketplace.service';

/**
 * The mentoring workflow must be safe: no self-requests, no duplicate open
 * requests, a strict request→accepted→completed lifecycle (mentor-gated), and
 * org-only mentors must not leak into another org's browse list.
 */
const MENTOR = '507f1f77bcf86cd799439011';
const STUDENT = '507f1f77bcf86cd799439012';
const SID = '507f1f77bcf86cd799439013';

interface Mocks {
  profiles?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
  users?: Record<string, unknown>;
}
function svc(over: Mocks = {}): MentorMarketplaceService {
  const ledger = { record: jest.fn().mockResolvedValue(undefined) };
  return new MentorMarketplaceService(
    (over.profiles ?? {}) as never,
    (over.sessions ?? {}) as never,
    (over.users ?? { findById: jest.fn().mockResolvedValue(null) }) as never,
    ledger as never,
  );
}

function sessionDoc(status: string): Record<string, unknown> & {
  save: jest.Mock;
} {
  return {
    status,
    mentor: MENTOR,
    student: STUDENT,
    notes: '',
    type: 'general',
    save: jest.fn().mockResolvedValue(undefined),
  };
}
function withSession(doc: Record<string, unknown>): MentorMarketplaceService {
  return svc({
    sessions: { findOne: () => ({ exec: () => Promise.resolve(doc) }) },
    users: { findById: jest.fn().mockResolvedValue({ name: 'M' }) },
  });
}

describe('MentorMarketplaceService — workflow', () => {
  it('rejects requesting a session with your own profile', async () => {
    const s = svc({
      profiles: {
        findById: () => ({ exec: () => Promise.resolve({ user: STUDENT }) }),
      },
    });
    await expect(
      s.requestSession(STUDENT, { mentorId: 'p1', type: 'general' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate open request to the same mentor', async () => {
    const s = svc({
      profiles: {
        findById: () => ({ exec: () => Promise.resolve({ user: MENTOR }) }),
      },
      sessions: {
        findOne: () => ({ exec: () => Promise.resolve({ _id: 'existing' }) }),
      },
    });
    await expect(
      s.requestSession(STUDENT, { mentorId: 'p1', type: 'general' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a request when none is open', async () => {
    const create = jest
      .fn()
      .mockResolvedValue({ _id: 'new', status: 'requested' });
    const s = svc({
      profiles: {
        findById: () => ({ exec: () => Promise.resolve({ user: MENTOR }) }),
      },
      sessions: {
        findOne: () => ({ exec: () => Promise.resolve(null) }),
        create,
      },
    });
    const r = await s.requestSession(STUDENT, {
      mentorId: 'p1',
      type: 'general',
    } as never);
    expect(create).toHaveBeenCalled();
    expect(r.status).toBe('requested');
  });

  it('rejects an illegal transition (requested → completed)', async () => {
    const s = withSession(sessionDoc('requested'));
    await expect(
      s.updateStatus(MENTOR, SID, 'completed'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a mentor can accept a requested session, with a slot', async () => {
    const doc = sessionDoc('requested');
    await withSession(doc).updateStatus(
      MENTOR,
      SID,
      'accepted',
      '2026-07-10T10:00:00.000Z',
    );
    expect(doc.status).toBe('accepted');
    expect(doc.scheduledAt).toBeInstanceOf(Date);
  });

  it('a student cannot accept (mentor-only)', async () => {
    const s = withSession(sessionDoc('requested'));
    await expect(
      s.updateStatus(STUDENT, SID, 'accepted'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a mentor can complete an accepted session', async () => {
    const doc = sessionDoc('accepted');
    await withSession(doc).updateStatus(MENTOR, SID, 'completed');
    expect(doc.status).toBe('completed');
  });

  it('a terminal (completed) session cannot change', async () => {
    const s = withSession(sessionDoc('completed'));
    await expect(
      s.updateStatus(MENTOR, SID, 'cancelled'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('either party can cancel a requested session', async () => {
    const doc = sessionDoc('requested');
    await withSession(doc).updateStatus(STUDENT, SID, 'cancelled');
    expect(doc.status).toBe('cancelled');
  });

  it('listMentors hides your own profile and other-org mentors', async () => {
    const list = [
      {
        _id: 'a',
        user: MENTOR,
        visibility: 'public',
        expertise: [],
        ratingSummary: { avg: 0, count: 0 },
      },
      {
        _id: 'b',
        user: 'pub',
        visibility: 'public',
        expertise: [],
        ratingSummary: { avg: 0, count: 0 },
      },
      {
        _id: 'c',
        user: 'o1',
        visibility: 'org',
        organization: 'orgA',
        expertise: [],
        ratingSummary: { avg: 0, count: 0 },
      },
      {
        _id: 'd',
        user: 'o2',
        visibility: 'org',
        organization: 'orgB',
        expertise: [],
        ratingSummary: { avg: 0, count: 0 },
      },
    ];
    const chain = {
      sort: () => chain,
      limit: () => chain,
      exec: () => Promise.resolve(list),
    };
    const s = svc({
      profiles: { find: () => chain },
      users: {
        findById: jest
          .fn()
          .mockImplementation((id: string) =>
            id === MENTOR
              ? Promise.resolve({ primaryOrganization: 'orgA' })
              : Promise.resolve({ name: 'X' }),
          ),
      },
    });
    const result = await s.listMentors(MENTOR);
    // own (a) excluded, public (b) in, same-org (c) in, other-org (d) out.
    expect(result.map((r) => r.id).sort()).toEqual(['b', 'c']);
  });
});
