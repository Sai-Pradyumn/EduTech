import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { CohortStatus } from '../../../common/enums';
import { LearningIntelligenceService } from '../../learning-intelligence/learning-intelligence.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { Cohort, CohortDocument } from '../schemas/cohort.schema';

export interface CohortView {
  id: string;
  organizationId: string;
  organizationName?: string;
  name: string;
  description: string;
  roadmapGoal: string;
  status: CohortStatus;
  startDate?: string;
  endDate?: string;
  mentorCount: number;
  studentCount: number;
  announcementCount: number;
}

export interface MemberLite {
  userId: string;
  name: string;
  email: string;
}

export interface CohortDetail extends CohortView {
  mentors: MemberLite[];
  students: MemberLite[];
  announcements: { id: string; title: string; body: string; authorName: string; createdAt: string }[];
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  health: number;
  readiness: number;
  activeDays: number;
}

const LEADERBOARD_CAP = 50;

@Injectable()
export class CohortService {
  constructor(
    @InjectModel(Cohort.name) private readonly cohorts: Model<CohortDocument>,
    private readonly intelligence: LearningIntelligenceService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    orgId: string,
    createdById: string,
    input: { name: string; description?: string; roadmapGoal?: string; startDate?: string; endDate?: string; status?: CohortStatus },
  ): Promise<CohortView> {
    const cohort = await this.cohorts.create({
      organization: new Types.ObjectId(orgId),
      name: input.name,
      description: input.description ?? '',
      roadmapGoal: input.roadmapGoal ?? '',
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      status: input.status ?? CohortStatus.Draft,
      createdBy: new Types.ObjectId(createdById),
    });
    return this.toView(cohort);
  }

  async listForOrg(orgId: string): Promise<CohortView[]> {
    const list = await this.cohorts
      .find({ organization: new Types.ObjectId(orgId) })
      .sort({ createdAt: -1 })
      .lean<CohortDocument[]>()
      .exec();
    return list.map((c) => this.toViewLean(c));
  }

  /** Cohorts the user belongs to as a student (across orgs). */
  async listForStudent(userId: string): Promise<CohortView[]> {
    const list = await this.cohorts
      .find({ students: new Types.ObjectId(userId) })
      .populate<{ organization: { _id: Types.ObjectId; name: string } }>('organization', 'name')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return list.map((c) => ({
      ...this.toViewLean(c as unknown as CohortDocument),
      organizationName: (c.organization as { name?: string } | undefined)?.name,
    }));
  }

  async orgIdOf(id: string): Promise<string> {
    const c = await this.cohorts.findById(id).select('organization').lean<{ organization: Types.ObjectId }>().exec();
    if (!c) throw new NotFoundException('Cohort not found');
    return String(c.organization);
  }

  async getDetail(id: string): Promise<CohortDetail> {
    const c = await this.cohorts
      .findById(id)
      .populate<{ mentors: { _id: Types.ObjectId; name: string; email: string }[] }>('mentors', 'name email')
      .populate<{ students: { _id: Types.ObjectId; name: string; email: string }[] }>('students', 'name email')
      .populate<{ organization: { _id: Types.ObjectId; name: string } }>('organization', 'name')
      .lean()
      .exec();
    if (!c) throw new NotFoundException('Cohort not found');
    const toLite = (m: { _id: Types.ObjectId; name: string; email: string }): MemberLite => ({
      userId: String(m._id),
      name: m.name,
      email: m.email,
    });
    return {
      id: String(c._id),
      organizationId: String((c.organization as { _id?: Types.ObjectId } | undefined)?._id ?? ''),
      organizationName: (c.organization as { name?: string } | undefined)?.name,
      name: c.name,
      description: c.description,
      roadmapGoal: c.roadmapGoal,
      status: c.status,
      startDate: c.startDate ? new Date(c.startDate).toISOString() : undefined,
      endDate: c.endDate ? new Date(c.endDate).toISOString() : undefined,
      mentorCount: c.mentors.length,
      studentCount: c.students.length,
      announcementCount: c.announcements.length,
      mentors: (c.mentors as { _id: Types.ObjectId; name: string; email: string }[]).map(toLite),
      students: (c.students as { _id: Types.ObjectId; name: string; email: string }[]).map(toLite),
      announcements: [...c.announcements]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((a) => ({ id: a.id, title: a.title, body: a.body, authorName: a.authorName, createdAt: new Date(a.createdAt).toISOString() })),
    };
  }

  async update(
    id: string,
    patch: { name?: string; description?: string; roadmapGoal?: string; startDate?: string; endDate?: string; status?: CohortStatus },
  ): Promise<CohortView> {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) set['name'] = patch.name;
    if (patch.description !== undefined) set['description'] = patch.description;
    if (patch.roadmapGoal !== undefined) set['roadmapGoal'] = patch.roadmapGoal;
    if (patch.startDate !== undefined) set['startDate'] = new Date(patch.startDate);
    if (patch.endDate !== undefined) set['endDate'] = new Date(patch.endDate);
    if (patch.status !== undefined) set['status'] = patch.status;
    const c = await this.cohorts.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
    if (!c) throw new NotFoundException('Cohort not found');
    return this.toView(c);
  }

  async addMembers(id: string, userIds: string[], role: 'mentor' | 'student'): Promise<CohortDetail> {
    const ids = userIds.map((u) => new Types.ObjectId(u));
    const field = role === 'mentor' ? 'mentors' : 'students';
    await this.cohorts.updateOne({ _id: id }, { $addToSet: { [field]: { $each: ids } } }).exec();
    return this.getDetail(id);
  }

  async removeMember(id: string, userId: string): Promise<CohortDetail> {
    const oid = new Types.ObjectId(userId);
    await this.cohorts.updateOne({ _id: id }, { $pull: { mentors: oid, students: oid } }).exec();
    return this.getDetail(id);
  }

  async postAnnouncement(id: string, authorName: string, title: string, body: string): Promise<CohortDetail> {
    await this.cohorts
      .updateOne({ _id: id }, { $push: { announcements: { id: randomUUID(), title, body, authorName, createdAt: new Date() } } })
      .exec();
    const detail = await this.getDetail(id);
    // B13: notify enrolled students of the new announcement.
    await this.notifications.createMany(
      detail.students.map((s) => s.userId),
      { type: 'announcement', title: `${detail.name}: ${title}`, body, link: '/app/cohorts' },
    );
    return detail;
  }

  async leaderboard(id: string): Promise<LeaderboardRow[]> {
    const c = await this.cohorts
      .findById(id)
      .populate<{ students: { _id: Types.ObjectId; name: string }[] }>('students', 'name')
      .lean()
      .exec();
    if (!c) throw new NotFoundException('Cohort not found');
    const students = (c.students as { _id: Types.ObjectId; name: string }[]).slice(0, LEADERBOARD_CAP);
    const rows = await Promise.all(
      students.map(async (s) => {
        const li = await this.intelligence.overview(String(s._id));
        return {
          userId: String(s._id),
          name: s.name,
          health: li.healthScore,
          readiness: li.readinessScore,
          activeDays: li.momentum.activeDays,
        };
      }),
    );
    rows.sort((a, b) => b.health - a.health || b.readiness - a.readiness);
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.cohorts.deleteOne({ _id: id }).exec();
    return { ok: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private toView(c: CohortDocument): CohortView {
    return {
      id: String(c._id),
      organizationId: String(c.organization),
      name: c.name,
      description: c.description,
      roadmapGoal: c.roadmapGoal,
      status: c.status,
      startDate: c.startDate ? c.startDate.toISOString() : undefined,
      endDate: c.endDate ? c.endDate.toISOString() : undefined,
      mentorCount: c.mentors.length,
      studentCount: c.students.length,
      announcementCount: c.announcements.length,
    };
  }

  private toViewLean(c: CohortDocument): CohortView {
    return {
      id: String(c._id),
      organizationId: String(c.organization),
      name: c.name,
      description: c.description,
      roadmapGoal: c.roadmapGoal,
      status: c.status,
      startDate: c.startDate ? new Date(c.startDate).toISOString() : undefined,
      endDate: c.endDate ? new Date(c.endDate).toISOString() : undefined,
      mentorCount: c.mentors?.length ?? 0,
      studentCount: c.students?.length ?? 0,
      announcementCount: c.announcements?.length ?? 0,
    };
  }
}
