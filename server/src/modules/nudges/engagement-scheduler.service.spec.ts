import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { MailerService } from '../mailer/mailer.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EngagementSchedulerService } from './engagement-scheduler.service';

/**
 * Time-based engagement must be honest and quiet: nudge only when there is a
 * real reason, digest only when there is something to say, email only when
 * SMTP is actually configured.
 */

type Doc = Record<string, unknown>;
const USER_ID = '507f1f77bcf86cd799439011';

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function fakeModel(docs: Doc[] | Doc | null) {
  const exec = jest.fn(() => Promise.resolve(docs));
  const chain: Record<string, unknown> = { exec };
  for (const m of ['sort', 'limit', 'lean']) chain[m] = jest.fn(() => chain);
  return {
    find: jest.fn(() => chain),
    findOne: jest.fn(() => chain),
  } as unknown as Model<never>;
}

function build(over: Partial<Record<string, unknown>> = {}) {
  const plans = fakeModel((over.plans as Doc[]) ?? []);
  const roadmaps = fakeModel(
    'roadmap' in over
      ? (over.roadmap as Doc | null)
      : {
          title: 'Java Path',
          progressPercentage: 40,
          weeklyPlan: [{ weekNumber: 1, focus: 'Collections' }],
          completedWeeks: [],
        },
  );
  const users = fakeModel([]);
  const mistakes = {
    due: jest.fn().mockResolvedValue(over.due ?? []),
    list: jest
      .fn()
      .mockResolvedValue(over.open ?? [{ concept: 'recursion', severity: 70 }]),
  };
  const notifications = { createUnique: jest.fn().mockResolvedValue({}) };
  const mailer = { live: over.mailerLive ?? false, send: jest.fn() };

  const liveSessions = fakeModel([]);
  const svc = new EngagementSchedulerService(
    users as never,
    plans as never,
    roadmaps as never,
    liveSessions as never,
    mistakes as unknown as MistakesService,
    notifications as unknown as NotificationsService,
    mailer as unknown as MailerService,
  );
  return { svc, notifications, mailer, mistakes };
}

describe('EngagementSchedulerService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('nudges a learner inactive for ≥3 days, pointing at Today', async () => {
    const { svc, notifications } = build({
      plans: [
        { date: isoDaysAgo(4), items: [{ done: true, estimateMinutes: 20 }] },
      ],
    });
    await svc.evaluateDaily(USER_ID);
    const calls = notifications.createUnique.mock.calls as [string, Doc][];
    const inactivity = calls.find(
      ([, n]) => (n as { link: string }).link === '/app/today',
    );
    expect(inactivity).toBeTruthy();
  });

  it('an active learner (done today) gets no inactivity nudge', async () => {
    const { svc, notifications } = build({
      plans: [
        { date: isoDaysAgo(0), items: [{ done: true, estimateMinutes: 20 }] },
      ],
    });
    await svc.evaluateDaily(USER_ID);
    const calls = notifications.createUnique.mock.calls as [string, Doc][];
    expect(
      calls.some(([, n]) => (n as { link: string }).link === '/app/today'),
    ).toBe(false);
  });

  it('brand-new users (no plan history) are never called inactive', async () => {
    const { svc, notifications } = build({ plans: [] });
    await svc.evaluateDaily(USER_ID);
    const calls = notifications.createUnique.mock.calls as [string, Doc][];
    expect(
      calls.some(([, n]) => (n as { link: string }).link === '/app/today'),
    ).toBe(false);
  });

  it('due spaced reviews raise a nudge naming the hardest concept', async () => {
    const { svc, notifications } = build({
      plans: [
        { date: isoDaysAgo(0), items: [{ done: true, estimateMinutes: 10 }] },
      ],
      due: [{ concept: 'SQL joins' }, { concept: 'indexes' }],
    });
    await svc.evaluateDaily(USER_ID);
    const calls = notifications.createUnique.mock.calls as [string, Doc][];
    const review = calls.find(([, n]) =>
      (n as { link: string }).link.includes('filter=due'),
    );
    expect(review).toBeTruthy();
    expect((review![1] as { body: string }).body).toContain('SQL joins');
  });

  it('digest reports real numbers and skips email when SMTP is off', async () => {
    const { svc, notifications, mailer } = build({
      plans: [
        {
          date: isoDaysAgo(2),
          items: [
            { done: true, estimateMinutes: 20 },
            { done: true, estimateMinutes: 15 },
            { done: false, estimateMinutes: 30 },
          ],
        },
      ],
    });
    const sent = await svc.sendDigest(USER_ID, 'a@b.c', 'Sam');
    expect(sent).toBe(true);
    const [, digest] = (
      notifications.createUnique.mock.calls as [string, Doc][]
    )[0];
    expect((digest as { body: string }).body).toContain('2 plan items');
    expect((digest as { body: string }).body).toContain('35 min');
    expect((digest as { body: string }).body).toContain('Java Path');
    expect(mailer.send).not.toHaveBeenCalled(); // SMTP off → no email attempt
  });

  it('digest emails when SMTP is live; zero-signal users get nothing', async () => {
    const live = build({
      plans: [
        { date: isoDaysAgo(1), items: [{ done: true, estimateMinutes: 10 }] },
      ],
      mailerLive: true,
    });
    await live.svc.sendDigest(USER_ID, 'a@b.c', 'Sam');
    expect(live.mailer.send).toHaveBeenCalledTimes(1);

    const silent = build({ plans: [], roadmap: null });
    const sent = await silent.svc.sendDigest(USER_ID, 'a@b.c', 'Sam');
    expect(sent).toBe(false);
    expect(silent.notifications.createUnique).not.toHaveBeenCalled();
  });
});
