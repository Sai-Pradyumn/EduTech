import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../../users/users.service';
import { MembershipService } from '../../tenancy/services/membership.service';
import { LearningIntelligenceService } from '../../learning-intelligence/learning-intelligence.service';
import { ProjectsService } from '../../projects/services/projects.service';
import {
  MentorProfile,
  MentorProfileDocument,
} from '../schemas/mentor-profile.schema';
import { MentorNote, MentorNoteDocument } from '../schemas/mentor-note.schema';

export type Risk = 'high' | 'medium' | 'low';

export interface StudentSummary {
  userId: string;
  name: string;
  email: string;
  organizationName: string;
  health: number;
  readiness: number;
  risk: Risk;
  topWeakness: string | null;
  strengths: string[];
  activeDays: number;
  summary: string;
}

export interface PendingReview {
  projectId: string;
  title: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  githubUrl?: string;
  demoUrl?: string;
}

const MAX_STUDENTS = 30;

/**
 * Mentor brain — turns B1 org memberships into "assigned students", and reuses the
 * Learning-Intelligence engine to compute per-student risk + an AI summary, surfaces the
 * project-review queue, and stores mentor notes. Org-scoped: a mentor only sees students
 * in the orgs where they mentor/instruct/admin.
 */
@Injectable()
export class MentorService {
  constructor(
    @InjectModel(MentorProfile.name)
    private readonly profiles: Model<MentorProfileDocument>,
    @InjectModel(MentorNote.name)
    private readonly notes: Model<MentorNoteDocument>,
    private readonly memberships: MembershipService,
    private readonly intelligence: LearningIntelligenceService,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
  ) {}

  async dashboard(mentorId: string): Promise<{
    students: StudentSummary[];
    atRiskCount: number;
    pendingReviews: PendingReview[];
    weeklyActions: string[];
  }> {
    const assigned = (await this.memberships.studentsForMentor(mentorId)).slice(
      0,
      MAX_STUDENTS,
    );
    const students = await Promise.all(
      assigned.map((s) =>
        this.summarize(s.userId, s.name, s.email, s.organizationName),
      ),
    );
    const pendingReviews = await this.pendingReviews(mentorId);
    const atRisk = students.filter((s) => s.risk === 'high');

    const weeklyActions: string[] = [];
    if (pendingReviews.length)
      weeklyActions.push(
        `Review ${pendingReviews.length} pending project submission(s).`,
      );
    if (atRisk.length)
      weeklyActions.push(
        `Check in with ${atRisk.length} at-risk student(s): ${atRisk
          .slice(0, 3)
          .map((s) => s.name.split(' ')[0])
          .join(', ')}.`,
      );
    const stalled = students.filter(
      (s) => s.activeDays === 0 && s.risk !== 'high',
    );
    if (stalled.length)
      weeklyActions.push(
        `Nudge ${stalled.length} inactive student(s) to resume this week.`,
      );
    if (weeklyActions.length === 0)
      weeklyActions.push(
        'All clear — your students are on track. Consider raising the bar with a harder project.',
      );

    return {
      students,
      atRiskCount: atRisk.length,
      pendingReviews,
      weeklyActions,
    };
  }

  async studentDetail(
    mentorId: string,
    studentId: string,
  ): Promise<{
    summary: StudentSummary;
    notes: { id: string; content: string; createdAt: string }[];
    projects: PendingReview[];
  }> {
    await this.assertAssigned(mentorId, studentId);
    const user = await this.users.findByIdOrThrow(studentId);
    const summary = await this.summarize(studentId, user.name, user.email, '');
    const notes = await this.listNotes(mentorId, studentId);
    const submitted = await this.projects.submittedForUsers([studentId]);
    const projects = submitted.map((p) => this.toPending(p, user.name));
    return { summary, notes, projects };
  }

  async addNote(
    mentorId: string,
    studentId: string,
    content: string,
  ): Promise<{ id: string; content: string; createdAt: string }> {
    await this.assertAssigned(mentorId, studentId);
    const note = await this.notes.create({
      mentor: new Types.ObjectId(mentorId),
      student: new Types.ObjectId(studentId),
      content,
    });
    return {
      id: String(note._id),
      content: note.content,
      createdAt: new Date().toISOString(),
    };
  }

  async listNotes(
    mentorId: string,
    studentId: string,
  ): Promise<{ id: string; content: string; createdAt: string }[]> {
    const notes = await this.notes
      .find({
        mentor: new Types.ObjectId(mentorId),
        student: new Types.ObjectId(studentId),
      })
      .sort({ createdAt: -1 })
      .lean<MentorNoteDocument[]>()
      .exec();
    return notes.map((n) => ({
      id: String(n._id),
      content: n.content,
      createdAt: (n as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    }));
  }

  async reviewProject(
    mentorId: string,
    projectId: string,
    decision: 'approved' | 'changes_requested',
    feedback: string,
    score?: number,
  ) {
    const reviewer = await this.users.findByIdOrThrow(mentorId);
    const project = await this.projects.mentorReview(
      mentorId,
      reviewer.name,
      projectId,
      decision,
      feedback,
      score,
    );
    return {
      ok: true,
      projectId: String(project._id),
      decision: project.mentorReview?.decision,
    };
  }

  // ── profile ────────────────────────────────────────────────────────────────
  async getProfile(userId: string): Promise<MentorProfileDocument | null> {
    return this.profiles.findOne({ user: new Types.ObjectId(userId) }).exec();
  }

  async upsertProfile(
    userId: string,
    patch: Partial<MentorProfile>,
  ): Promise<MentorProfileDocument> {
    return this.profiles
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $set: { ...patch, user: new Types.ObjectId(userId) } },
        { new: true, upsert: true },
      )
      .exec();
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async pendingReviews(mentorId: string): Promise<PendingReview[]> {
    const assigned = await this.memberships.studentsForMentor(mentorId);
    const nameById = new Map(assigned.map((s) => [s.userId, s.name]));
    const submitted = await this.projects.submittedForUsers(
      assigned.map((s) => s.userId),
    );
    return submitted
      .filter((p) => !p.mentorReview?.reviewedAt)
      .map((p) => this.toPending(p, nameById.get(String(p.user)) ?? 'Student'));
  }

  private toPending(
    p: {
      _id: unknown;
      title: string;
      user: unknown;
      submission?: { submittedAt?: Date; githubUrl?: string; demoUrl?: string };
    },
    studentName: string,
  ): PendingReview {
    return {
      projectId: String(p._id),
      title: p.title,
      studentId: String(p.user),
      studentName,
      submittedAt: p.submission?.submittedAt?.toISOString() ?? '',
      githubUrl: p.submission?.githubUrl,
      demoUrl: p.submission?.demoUrl,
    };
  }

  private async summarize(
    userId: string,
    name: string,
    email: string,
    organizationName: string,
  ): Promise<StudentSummary> {
    const li = await this.intelligence.overview(userId);
    const topWeakness = li.weaknesses[0]?.topic ?? null;
    const risk: Risk =
      li.healthScore < 40 || li.momentum.activeDays === 0
        ? 'high'
        : li.healthScore < 60
          ? 'medium'
          : 'low';
    const first = name.split(' ')[0];
    const activity =
      li.momentum.activeDays === 0
        ? 'Inactive in the last 2 weeks'
        : `${li.momentum.activeDays} active day(s) recently`;
    const summary = `${first} is at ${li.healthScore}% learning health, ${li.readinessScore}% readiness. ${
      li.strengths[0] ? `Strong on ${li.strengths[0]}. ` : ''
    }${topWeakness ? `Needs work on ${topWeakness}. ` : ''}${activity}.`;
    return {
      userId,
      name,
      email,
      organizationName,
      health: li.healthScore,
      readiness: li.readinessScore,
      risk,
      topWeakness,
      strengths: li.strengths,
      activeDays: li.momentum.activeDays,
      summary,
    };
  }

  private async assertAssigned(
    mentorId: string,
    studentId: string,
  ): Promise<void> {
    const assigned = await this.memberships.studentsForMentor(mentorId);
    if (!assigned.some((s) => s.userId === studentId)) {
      throw new ForbiddenException(
        'This student is not in your mentored organizations.',
      );
    }
  }
}
