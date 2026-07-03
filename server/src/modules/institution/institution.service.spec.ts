import { ForbiddenException } from '@nestjs/common';
import { InstitutionService } from './institution.service';

/**
 * Institution assignments must be real (persisted + announced, org-scoped) and
 * analytics must be honest about sampling — the totals report true enrolment,
 * separately from how many students readiness was actually computed for.
 */
const ORG = '507f1f77bcf86cd799439011';
const UID = '507f1f77bcf86cd799439012';
const CID = '507f1f77bcf86cd799439013';

function svc(
  over: {
    cohorts?: Record<string, unknown>;
    readiness?: Record<string, unknown>;
    users?: Record<string, unknown>;
    assignments?: Record<string, unknown>;
  } = {},
): InstitutionService {
  return new InstitutionService(
    (over.cohorts ?? {}) as never,
    (over.readiness ?? {}) as never,
    (over.users ?? {}) as never,
    (over.assignments ?? {}) as never,
  );
}

describe('InstitutionService', () => {
  it('assign persists a real assignment, announces it, and returns the id', async () => {
    const create = jest.fn().mockResolvedValue({ _id: 'a1' });
    const post = jest.fn().mockResolvedValue(undefined);
    const s = svc({
      users: {
        findByIdOrThrow: jest
          .fn()
          .mockResolvedValue({ name: 'Mentor M', primaryOrganization: ORG }),
      },
      cohorts: {
        orgIdOf: jest.fn().mockResolvedValue(ORG),
        postAnnouncement: post,
      },
      assignments: { create },
    });
    const r = await s.assign(UID, CID, {
      kind: 'flow',
      title: 'Build a CLI',
      dueAt: '2026-08-01',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'flow', title: 'Build a CLI' }),
    );
    expect(post).toHaveBeenCalled();
    expect(r).toEqual({ ok: true, id: 'a1' });
  });

  it('rejects assigning to a cohort in another institution', async () => {
    const s = svc({
      users: {
        findByIdOrThrow: jest
          .fn()
          .mockResolvedValue({ primaryOrganization: ORG }),
      },
      cohorts: {
        orgIdOf: jest.fn().mockResolvedValue('507f1f77bcf86cd799439077'),
      },
      assignments: { create: jest.fn() },
    });
    await expect(
      s.assign(UID, CID, { kind: 'flow', title: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('overview reports true enrolled totals separately from the sampled count', async () => {
    const students = Array.from({ length: 30 }, (_, i) => ({
      userId: 'u' + i,
      name: 'S' + i,
    }));
    const s = svc({
      users: {
        findByIdOrThrow: jest
          .fn()
          .mockResolvedValue({ primaryOrganization: ORG }),
      },
      readiness: {
        analyze: jest.fn().mockResolvedValue({
          readinessScore: 70,
          band: 'developing',
          skillGaps: [],
        }),
      },
      cohorts: {
        listForOrg: jest
          .fn()
          .mockResolvedValue([
            { id: CID, name: 'Cohort 1', organizationName: 'Acme' },
          ]),
        getDetail: jest
          .fn()
          .mockResolvedValue({ id: CID, name: 'Cohort 1', students }),
      },
    });
    const ov = await s.overview(UID);
    // 30 enrolled, but only the per-cohort cap (25) were computed.
    expect(ov.totals.students).toBe(30);
    expect(ov.totals.sampled).toBe(25);
    expect(ov.cohorts[0].students).toBe(30);
    expect(ov.cohorts[0].sampledStudents).toBe(25);
  });

  it('listAssignments flags overdue assignments', async () => {
    const past = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 86_400_000);
    const find = jest.fn().mockReturnValue({
      sort: () => ({
        limit: () => ({
          exec: () =>
            Promise.resolve([
              {
                _id: 'a1',
                kind: 'flow',
                title: 'Old',
                note: '',
                dueAt: past,
                createdBy: UID,
                createdAt: past,
              },
              {
                _id: 'a2',
                kind: 'quiz',
                title: 'New',
                note: '',
                dueAt: future,
                createdBy: UID,
                createdAt: future,
              },
            ]),
        }),
      }),
    });
    const s = svc({
      users: {
        findByIdOrThrow: jest
          .fn()
          .mockResolvedValue({ primaryOrganization: ORG }),
        findById: jest.fn().mockResolvedValue({ name: 'M' }),
      },
      cohorts: { orgIdOf: jest.fn().mockResolvedValue(ORG) },
      assignments: { find },
    });
    const list = await s.listAssignments(UID, CID);
    expect(list.find((a) => a.id === 'a1')!.overdue).toBe(true);
    expect(list.find((a) => a.id === 'a2')!.overdue).toBe(false);
  });
});
