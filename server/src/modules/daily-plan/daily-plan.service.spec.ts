import { DailyPlanService } from './daily-plan.service';

/**
 * The daily-plan carry-over, reorder and completion-proof logic runs on the real
 * document (not a fresh generation), so it is unit-testable with a plain mock doc.
 * These guard the loops the Today screen depends on: nothing silently dropped on
 * reorder, yesterday's open work pulled forward once, and a single honest proof
 * event when the whole plan is finished.
 */
interface MockItem {
  id: string;
  kind: string;
  title: string;
  reason: string;
  route: string;
  estimateMinutes: number;
  done: boolean;
  sourceId?: string;
  note?: string;
}

function planDoc(over: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = {
    _id: 'plan1',
    date: '2026-07-03',
    mode: 'normal',
    totalMinutes: 35,
    completedLoggedAt: undefined,
    items: [
      {
        id: 'i1',
        kind: 'quiz',
        title: 'A',
        reason: 'r',
        route: '/a',
        estimateMinutes: 20,
        done: false,
      },
      {
        id: 'i2',
        kind: 'mistake',
        title: 'B',
        reason: 'r',
        route: '/b',
        estimateMinutes: 15,
        done: false,
      },
    ] as MockItem[],
    markModified: jest.fn(),
    ...over,
  };
  doc.save = jest.fn(() => Promise.resolve(doc));
  return doc as Record<string, unknown> & {
    items: MockItem[];
    save: jest.Mock;
  };
}

function service(model: unknown, ledger: unknown = { record: jest.fn() }) {
  return new DailyPlanService(
    model as never,
    {} as never,
    {} as never,
    {} as never,
    ledger as never,
  );
}

describe('DailyPlanService', () => {
  it('reorder applies the requested order and appends anything unmentioned', async () => {
    const doc = planDoc();
    const model = {
      findOne: jest.fn(() => ({ exec: () => Promise.resolve(doc) })),
    };
    const res = await service(model).reorder('507f1f77bcf86cd799439011', [
      'i2',
    ]);
    expect(res.items.map((i) => i.id)).toEqual(['i2', 'i1']);
  });

  it('completing the final item logs exactly one daily_plan_completed proof', async () => {
    const doc = planDoc({
      items: [
        {
          id: 'i1',
          kind: 'quiz',
          title: 'A',
          reason: 'r',
          route: '/a',
          estimateMinutes: 20,
          done: true,
        },
        {
          id: 'i2',
          kind: 'mistake',
          title: 'B',
          reason: 'r',
          route: '/b',
          estimateMinutes: 15,
          done: false,
        },
      ] as MockItem[],
    });
    const ledger = { record: jest.fn().mockResolvedValue(undefined) };
    const model = {
      findOne: jest.fn(() => ({ exec: () => Promise.resolve(doc) })),
    };
    const svc = service(model, ledger);

    await svc.completeItem('507f1f77bcf86cd799439011', 'i2'); // i2 → done ⇒ whole plan done ⇒ log
    expect(ledger.record).toHaveBeenCalledTimes(1);
    const calls = ledger.record.mock.calls as unknown as [
      string,
      { kind: string },
    ][];
    expect(calls[0][1]).toMatchObject({ kind: 'daily_plan_completed' });

    await svc.completeItem('507f1f77bcf86cd799439011', 'i2'); // toggles back; must NOT double-log
    expect(ledger.record).toHaveBeenCalledTimes(1);
  });

  it("carry-over pulls yesterday's open items once, skipping done + already-present", async () => {
    const today = planDoc({
      date: '2026-07-03',
      items: [
        {
          id: 'i1',
          kind: 'quiz',
          title: 'A',
          reason: 'r',
          route: '/a',
          estimateMinutes: 20,
          done: false,
          sourceId: 's1',
        },
      ] as MockItem[],
    });
    const yesterday = planDoc({
      date: '2026-07-02',
      items: [
        {
          id: 'y1',
          kind: 'mistake',
          title: 'Old repair',
          reason: 'r',
          route: '/m',
          estimateMinutes: 15,
          done: false,
          sourceId: 's2',
        },
        {
          id: 'y2',
          kind: 'quiz',
          title: 'A',
          reason: 'r',
          route: '/a',
          estimateMinutes: 20,
          done: false,
          sourceId: 's1',
        }, // already present (sourceId)
        {
          id: 'y3',
          kind: 'quiz',
          title: 'Done thing',
          reason: 'r',
          route: '/d',
          estimateMinutes: 10,
          done: true,
          sourceId: 's3',
        }, // done → skip
      ] as MockItem[],
    });
    const model = {
      findOne: jest
        .fn()
        .mockReturnValueOnce({ exec: () => Promise.resolve(today) }) // getToday
        .mockReturnValueOnce({ exec: () => Promise.resolve(yesterday) }), // yesterday lookup
    };
    const res = await service(model).carryOver('507f1f77bcf86cd799439011');
    const titles = res.items.map((i) => i.title);
    expect(titles).toContain('Old repair'); // carried forward
    expect(titles.filter((t) => t === 'A')).toHaveLength(1); // not duplicated
    expect(titles).not.toContain('Done thing'); // finished work isn't carried
  });
});
