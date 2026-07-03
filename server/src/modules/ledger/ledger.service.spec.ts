import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import { LedgerService } from './ledger.service';
import type { LedgerEntryDocument } from './schemas/ledger-entry.schema';

/**
 * The Proof-of-Learning ledger must only record VERIFIED events, with the right
 * verification level per source, and its summary must aggregate honestly. These
 * guard the event→ledger projection the dashboard, passport and reports read.
 */
function build(entries: Partial<LedgerEntryDocument>[] = []) {
  const created: Record<string, unknown>[] = [];
  const chain = {
    sort: () => chain,
    limit: () => chain,
    exec: () => Promise.resolve(entries),
  };
  const model = {
    create: jest.fn((doc: Record<string, unknown>) => {
      created.push(doc);
      return Promise.resolve(doc);
    }),
    find: jest.fn(() => chain),
  };
  const service = new LedgerService(
    model as unknown as Model<LedgerEntryDocument>,
  );
  return { service, model, created };
}

describe('LedgerService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('records a passing quiz as a verified proof, ignores a failing one', async () => {
    const { service, created } = build();
    await service.onQuiz({
      userId: '507f1f77bcf86cd799439011',
      quizId: 'q1',
      quizTitle: 'Arrays',
      topic: 'arrays',
      score: 82,
    } as never);
    await service.onQuiz({
      userId: '507f1f77bcf86cd799439011',
      quizId: 'q2',
      quizTitle: 'Trees',
      topic: 'trees',
      score: 40,
    } as never);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      kind: 'quiz_passed',
      score: 82,
      skills: ['arrays'],
      verificationLevel: 'system',
    });
  });

  it('records week completion (system) and project submission (self)', async () => {
    const { service, created } = build();
    await service.onWeek({
      userId: '507f1f77bcf86cd799439011',
      weekNumber: 3,
      roadmapTitle: 'DSA',
      nextWeekFocus: 'Graphs',
    });
    await service.onProject({
      userId: '507f1f77bcf86cd799439011',
      projectId: 'p1',
      projectTitle: 'Portfolio',
    });
    expect(created.map((c) => c.kind)).toEqual([
      'week_completed',
      'project_submitted',
    ]);
    expect(created[0].verificationLevel).toBe('system');
    expect(created[1].verificationLevel).toBe('self');
  });

  it('never throws into callers when the write fails', async () => {
    const { service, model } = build();
    model.create.mockRejectedValueOnce(new Error('mongo down'));
    await expect(
      service.record('507f1f77bcf86cd799439011', {
        kind: 'quiz_passed',
        title: 'x',
      }),
    ).resolves.toBeUndefined();
  });

  it('summary aggregates by kind, verification, skills and active days', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    const earlier = new Date('2026-06-30T10:00:00.000Z');
    const { service } = build([
      {
        kind: 'quiz_passed',
        verificationLevel: 'system',
        skills: ['arrays'],
        visibleOnPassport: true,
        at: now,
      },
      {
        kind: 'quiz_passed',
        verificationLevel: 'system',
        skills: ['arrays', 'trees'],
        visibleOnPassport: false,
        at: now,
      },
      {
        kind: 'project_submitted',
        verificationLevel: 'self',
        skills: [],
        visibleOnPassport: true,
        at: earlier,
      },
    ] as Partial<LedgerEntryDocument>[]);
    const s = await service.summary('507f1f77bcf86cd799439011');
    expect(s.total).toBe(3);
    expect(s.activeDays).toBe(2);
    expect(s.byKind[0]).toEqual({ kind: 'quiz_passed', count: 2 });
    expect(s.verifiedCount).toBe(2); // 2 system; the self-verified one doesn't count
    expect(s.publicCount).toBe(2);
    expect(s.skills.find((x) => x.skill === 'arrays')?.count).toBe(2);
  });
});
