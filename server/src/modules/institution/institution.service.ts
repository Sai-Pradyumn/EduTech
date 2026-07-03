import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CohortService } from '../cohort/services/cohort.service';
import { CareerReadinessService } from '../career-readiness/career-readiness.service';
import { UsersService } from '../users/users.service';
import {
  AssignmentKind,
  InstitutionAssignment,
  InstitutionAssignmentDocument,
} from './schemas/institution-assignment.schema';

export interface StudentOutcome {
  id: string;
  name: string;
  readiness: number;
  band: string;
  topGap: string | null;
  atRisk: boolean;
}

export interface AssignmentView {
  id: string;
  kind: AssignmentKind;
  title: string;
  note: string;
  dueAt: string | null;
  overdue: boolean;
  createdBy: string;
  createdAt: string;
}

export interface InstitutionOverview {
  orgName: string;
  cohorts: {
    id: string;
    name: string;
    /** Total learners enrolled in the cohort. */
    students: number;
    /** How many we computed readiness for this request (see totals.sampled). */
    sampledStudents: number;
    avgReadiness: number;
    atRisk: number;
  }[];
  totals: {
    /** Total learners enrolled across the institution. */
    students: number;
    /** How many learners readiness was actually computed for (sampling cap). */
    sampled: number;
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
  /** Global cap on readiness computations per request (keeps it responsive). */
  private readonly MAX_STUDENTS = 60;
  /** Per-cohort sample cap so every cohort gets a representative sample. */
  private readonly MAX_PER_COHORT = 25;

  constructor(
    private readonly cohorts: CohortService,
    private readonly readiness: CareerReadinessService,
    private readonly users: UsersService,
    @InjectModel(InstitutionAssignment.name)
    private readonly assignments: Model<InstitutionAssignmentDocument>,
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
    let totalEnrolled = 0;

    for (const c of cohorts) {
      const detail = await this.cohorts.getDetail(c.id);
      totalEnrolled += detail.students.length;
      const outcomes: StudentOutcome[] = [];
      for (const s of detail.students) {
        // Per-cohort cap keeps every cohort represented; global cap bounds work.
        if (
          outcomes.length >= this.MAX_PER_COHORT ||
          processed >= this.MAX_STUDENTS
        )
          break;
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
        sampledStudents: outcomes.length,
        avgReadiness: avg,
        atRisk: outcomes.filter((o) => o.atRisk).length,
      });
    }

    const sampled = allOutcomes.length;
    const avgReadiness = sampled
      ? Math.round(allOutcomes.reduce((a, o) => a + o.readiness, 0) / sampled)
      : 0;
    return {
      orgName,
      cohorts: cohortRows,
      totals: {
        students: totalEnrolled,
        sampled,
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
  ): Promise<{
    id: string;
    name: string;
    total: number;
    sampled: number;
    students: StudentOutcome[];
  }> {
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
      total: detail.students.length,
      sampled: students.length,
      students: students.sort((a, b) => b.readiness - a.readiness),
    };
  }

  /**
   * Assign a learning asset to a cohort — persisted as a real assignment (with an
   * optional due date), and also announced so learners see it (INST-GAP-001).
   */
  async assign(
    userId: string,
    cohortId: string,
    dto: {
      kind: AssignmentKind;
      title: string;
      note?: string;
      dueAt?: string;
    },
  ): Promise<{ ok: true; id: string }> {
    const orgId = await this.assertOrg(userId, cohortId);
    const user = await this.users.findByIdOrThrow(userId);
    const parsedDue = dto.dueAt ? new Date(dto.dueAt) : undefined;
    const dueAt =
      parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue : undefined;

    const created = await this.assignments.create({
      organization: new Types.ObjectId(orgId),
      cohort: new Types.ObjectId(cohortId),
      createdBy: new Types.ObjectId(userId),
      kind: dto.kind,
      title: dto.title,
      note: dto.note ?? '',
      dueAt,
    });

    const dueLine = dueAt ? ` Due ${dueAt.toDateString()}.` : '';
    const noteLine = dto.note ? ` Note: ${dto.note}` : '';
    await this.cohorts.postAnnouncement(
      cohortId,
      user.name,
      `Assigned ${dto.kind}: ${dto.title}`,
      `Your mentor assigned a ${dto.kind} — "${dto.title}".${dueLine} Open it from your dashboard to begin.${noteLine}`,
    );
    return { ok: true, id: String(created._id) };
  }

  /** A cohort's assignments, newest first, with an overdue flag. */
  async listAssignments(
    userId: string,
    cohortId: string,
  ): Promise<AssignmentView[]> {
    await this.assertOrg(userId, cohortId);
    const list = await this.assignments
      .find({ cohort: new Types.ObjectId(cohortId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    const now = Date.now();
    return Promise.all(
      list.map(async (a) => {
        const by = await this.users
          .findById(String(a.createdBy))
          .catch(() => null);
        return {
          id: String(a._id),
          kind: a.kind,
          title: a.title,
          note: a.note,
          dueAt: a.dueAt?.toISOString() ?? null,
          overdue: !!a.dueAt && a.dueAt.getTime() < now,
          createdBy: by?.name ?? 'Mentor',
          createdAt:
            (
              a as InstitutionAssignmentDocument & { createdAt?: Date }
            ).createdAt?.toISOString() ?? '',
        };
      }),
    );
  }

  private async assertOrg(userId: string, cohortId: string): Promise<string> {
    if (!Types.ObjectId.isValid(cohortId))
      throw new ForbiddenException('That cohort is not in your institution.');
    const [orgId, cohortOrg] = await Promise.all([
      this.orgIdOf(userId),
      this.cohorts.orgIdOf(cohortId),
    ]);
    if (orgId !== cohortOrg)
      throw new ForbiddenException('That cohort is not in your institution.');
    return orgId;
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
