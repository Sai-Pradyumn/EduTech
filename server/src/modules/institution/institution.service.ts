import { ForbiddenException, Injectable } from '@nestjs/common';
import { CohortService } from '../cohort/services/cohort.service';
import { CareerReadinessService } from '../career-readiness/career-readiness.service';
import { UsersService } from '../users/users.service';

export interface StudentOutcome {
  id: string;
  name: string;
  readiness: number;
  band: string;
  topGap: string | null;
  atRisk: boolean;
}

export interface InstitutionOverview {
  orgName: string;
  cohorts: {
    id: string;
    name: string;
    students: number;
    avgReadiness: number;
    atRisk: number;
  }[];
  totals: {
    students: number;
    avgReadiness: number;
    atRisk: number;
    jobReady: number;
  };
  topPerformers: { name: string; readiness: number }[];
  riskStudents: { name: string; readiness: number; topGap: string | null }[];
  weakConcepts: { concept: string; count: number }[];
}

/**
 * Phase 9 · Institution Outcome Layer — cohort/placement-readiness analytics for colleges & bootcamps.
 * Reuses the org/cohort modules + the Career Readiness engine; respects org isolation (admin/mentor's
 * own org only). Computes readiness per student and rolls it up to cohort and institution level.
 */
@Injectable()
export class InstitutionService {
  /** Cap how many students we compute readiness for in one request (keeps it responsive). */
  private readonly MAX_STUDENTS = 40;

  constructor(
    private readonly cohorts: CohortService,
    private readonly readiness: CareerReadinessService,
    private readonly users: UsersService,
  ) {}

  private async orgIdOf(userId: string): Promise<string> {
    const user = await this.users.findByIdOrThrow(userId);
    const orgId = (user as { primaryOrganization?: { toString(): string } })
      .primaryOrganization;
    if (!orgId)
      throw new ForbiddenException('You are not part of an institution.');
    return String(orgId);
  }

  async overview(userId: string): Promise<InstitutionOverview> {
    const orgId = await this.orgIdOf(userId);
    const cohorts = await this.cohorts.listForOrg(orgId);
    const orgName =
      (cohorts[0] as { organizationName?: string } | undefined)
        ?.organizationName ?? 'Your institution';

    const cohortRows: InstitutionOverview['cohorts'] = [];
    const allOutcomes: StudentOutcome[] = [];
    const gapTally = new Map<string, number>();
    let processed = 0;

    for (const c of cohorts) {
      const detail = await this.cohorts.getDetail(c.id);
      const outcomes: StudentOutcome[] = [];
      for (const s of detail.students) {
        if (processed >= this.MAX_STUDENTS) break;
        processed += 1;
        const outcome = await this.outcomeFor(s.userId, s.name, gapTally);
        outcomes.push(outcome);
        allOutcomes.push(outcome);
      }
      const avg = outcomes.length
        ? Math.round(
            outcomes.reduce((a, o) => a + o.readiness, 0) / outcomes.length,
          )
        : 0;
      cohortRows.push({
        id: c.id,
        name: c.name,
        students: detail.students.length,
        avgReadiness: avg,
        atRisk: outcomes.filter((o) => o.atRisk).length,
      });
    }

    const totalStudents = allOutcomes.length;
    const avgReadiness = totalStudents
      ? Math.round(
          allOutcomes.reduce((a, o) => a + o.readiness, 0) / totalStudents,
        )
      : 0;
    return {
      orgName,
      cohorts: cohortRows,
      totals: {
        students: totalStudents,
        avgReadiness,
        atRisk: allOutcomes.filter((o) => o.atRisk).length,
        jobReady: allOutcomes.filter((o) => o.readiness >= 82).length,
      },
      topPerformers: [...allOutcomes]
        .sort((a, b) => b.readiness - a.readiness)
        .slice(0, 5)
        .map((o) => ({ name: o.name, readiness: o.readiness })),
      riskStudents: allOutcomes
        .filter((o) => o.atRisk)
        .sort((a, b) => a.readiness - b.readiness)
        .slice(0, 5)
        .map((o) => ({
          name: o.name,
          readiness: o.readiness,
          topGap: o.topGap,
        })),
      weakConcepts: [...gapTally.entries()]
        .map(([concept, count]) => ({ concept, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    };
  }

  async cohortOutcomes(
    userId: string,
    cohortId: string,
  ): Promise<{ id: string; name: string; students: StudentOutcome[] }> {
    await this.assertOrg(userId, cohortId);
    const detail = await this.cohorts.getDetail(cohortId);
    const gapTally = new Map<string, number>();
    const students: StudentOutcome[] = [];
    for (const s of detail.students.slice(0, this.MAX_STUDENTS)) {
      students.push(await this.outcomeFor(s.userId, s.name, gapTally));
    }
    return {
      id: detail.id,
      name: detail.name,
      students: students.sort((a, b) => b.readiness - a.readiness),
    };
  }

  /** Assign a flow/template to a cohort by posting it as an announcement (foundation). */
  async assign(
    userId: string,
    cohortId: string,
    kind: 'flow' | 'template',
    title: string,
  ): Promise<{ ok: true }> {
    await this.assertOrg(userId, cohortId);
    const user = await this.users.findByIdOrThrow(userId);
    await this.cohorts.postAnnouncement(
      cohortId,
      user.name,
      `Assigned ${kind}: ${title}`,
      `Your mentor assigned a ${kind} — "${title}". Open it from your dashboard to begin.`,
    );
    return { ok: true };
  }

  private async assertOrg(userId: string, cohortId: string): Promise<void> {
    const [orgId, cohortOrg] = await Promise.all([
      this.orgIdOf(userId),
      this.cohorts.orgIdOf(cohortId),
    ]);
    if (orgId !== cohortOrg)
      throw new ForbiddenException('That cohort is not in your institution.');
  }

  private async outcomeFor(
    studentId: string,
    name: string,
    gapTally: Map<string, number>,
  ): Promise<StudentOutcome> {
    try {
      const a = await this.readiness.analyze(studentId);
      const topGap =
        a.skillGaps.filter((g) => !g.met).sort((x, y) => y.gap - x.gap)[0]
          ?.skill ?? null;
      a.skillGaps
        .filter((g) => !g.met)
        .slice(0, 3)
        .forEach((g) =>
          gapTally.set(g.skill, (gapTally.get(g.skill) ?? 0) + 1),
        );
      return {
        id: studentId,
        name,
        readiness: a.readinessScore,
        band: a.band,
        topGap,
        atRisk: a.readinessScore < 45,
      };
    } catch {
      return {
        id: studentId,
        name,
        readiness: 0,
        band: 'early',
        topGap: null,
        atRisk: true,
      };
    }
  }
}
