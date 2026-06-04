import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LiveSessionStatus } from '../../../common/enums';
import { CohortService } from '../../cohort/services/cohort.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  LiveSession,
  LiveSessionDocument,
} from '../schemas/live-session.schema';
import {
  CreateLiveSessionDto,
  UpdateLiveSessionDto,
} from '../dto/live-session.dto';

export interface SessionView {
  id: string;
  organizationId: string;
  cohortId?: string;
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  scheduledStart: string;
  durationMins: number;
  status: LiveSessionStatus;
  meetingUrl: string;
  attendeeCount: number;
}

export interface SessionDetail extends SessionView {
  notes: string;
  attendees: { userId: string; name: string; joinedAt: string }[];
  recap: {
    summary: string;
    keyPoints: string[];
    assignmentTitle: string;
    assignmentDescription: string;
    suggestedQuizTopic: string;
    generatedAt?: string;
  } | null;
}

@Injectable()
export class LiveSessionService {
  constructor(
    @InjectModel(LiveSession.name)
    private readonly sessions: Model<LiveSessionDocument>,
    private readonly cohorts: CohortService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    orgId: string,
    hostId: string,
    hostName: string,
    dto: CreateLiveSessionDto,
  ): Promise<SessionDetail> {
    const session = await this.sessions.create({
      organization: new Types.ObjectId(orgId),
      cohort: dto.cohortId ? new Types.ObjectId(dto.cohortId) : undefined,
      title: dto.title,
      description: dto.description ?? '',
      host: new Types.ObjectId(hostId),
      hostName,
      scheduledStart: new Date(dto.scheduledStart),
      durationMins: dto.durationMins ?? 60,
      status: LiveSessionStatus.Scheduled,
      meetingUrl: this.meetingLink(),
      createdBy: new Types.ObjectId(hostId),
    });
    // B13: notify cohort students that a session is scheduled.
    if (dto.cohortId)
      await this.notifyCohort(
        dto.cohortId,
        session.title,
        session.scheduledStart,
      );
    return this.detail(session);
  }

  async listForOrg(orgId: string): Promise<SessionView[]> {
    const list = await this.sessions
      .find({ organization: new Types.ObjectId(orgId) })
      .sort({ scheduledStart: -1 })
      .lean<LiveSessionDocument[]>()
      .exec();
    return list.map((s) => this.view(s));
  }

  /** Sessions for cohorts the student belongs to, or that they already joined. */
  async listForStudent(userId: string): Promise<SessionView[]> {
    const myCohorts = await this.cohorts.listForStudent(userId);
    const cohortIds = myCohorts.map((c) => new Types.ObjectId(c.id));
    const list = await this.sessions
      .find({
        $or: [
          ...(cohortIds.length ? [{ cohort: { $in: cohortIds } }] : []),
          { 'attendees.user': new Types.ObjectId(userId) },
        ],
      })
      .sort({ scheduledStart: -1 })
      .lean<LiveSessionDocument[]>()
      .exec();
    return list.map((s) => this.view(s));
  }

  async getDetail(id: string): Promise<SessionDetail> {
    return this.detail(await this.owned(id));
  }

  async orgIdOf(id: string): Promise<string> {
    const s = await this.sessions
      .findById(id)
      .select('organization')
      .lean<{ organization: Types.ObjectId }>()
      .exec();
    if (!s) throw new NotFoundException('Session not found');
    return String(s.organization);
  }

  async start(id: string): Promise<SessionDetail> {
    const s = await this.owned(id);
    if (
      s.status === LiveSessionStatus.Ended ||
      s.status === LiveSessionStatus.Cancelled
    ) {
      throw new BadRequestException('This session has already finished.');
    }
    s.status = LiveSessionStatus.Live;
    await s.save();
    return this.detail(s);
  }

  /** End the session and generate the AI recap from the host's notes. */
  async end(id: string, notes: string): Promise<SessionDetail> {
    const s = await this.owned(id);
    s.notes = notes ?? s.notes;
    s.status = LiveSessionStatus.Ended;
    s.recap = this.buildRecap(s.title, s.notes);
    s.markModified('recap');
    await s.save();
    // Nudge attendees that the recap + assignment are ready.
    if (s.attendees.length) {
      await this.notifications.createMany(
        s.attendees.map((a) => String(a.user)),
        {
          type: 'session',
          title: `Recap ready: ${s.title}`,
          body: s.recap.assignmentTitle,
          link: '/app/live-sessions',
        },
      );
    }
    return this.detail(s);
  }

  async join(id: string, userId: string, name: string): Promise<SessionDetail> {
    const s = await this.owned(id);
    if (s.status === LiveSessionStatus.Cancelled)
      throw new BadRequestException('This session was cancelled.');
    const already = s.attendees.some((a) => String(a.user) === userId);
    if (!already) {
      s.attendees.push({
        user: new Types.ObjectId(userId),
        name,
        joinedAt: new Date(),
      });
      await s.save();
    }
    return this.detail(s);
  }

  async update(id: string, dto: UpdateLiveSessionDto): Promise<SessionDetail> {
    const set: Record<string, unknown> = {};
    if (dto.title !== undefined) set['title'] = dto.title;
    if (dto.description !== undefined) set['description'] = dto.description;
    if (dto.scheduledStart !== undefined)
      set['scheduledStart'] = new Date(dto.scheduledStart);
    if (dto.durationMins !== undefined) set['durationMins'] = dto.durationMins;
    if (dto.status !== undefined) set['status'] = dto.status;
    const s = await this.sessions
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .exec();
    if (!s) throw new NotFoundException('Session not found');
    return this.detail(s);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.sessions.deleteOne({ _id: id }).exec();
    return { ok: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private async owned(id: string): Promise<LiveSessionDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Session not found');
    const s = await this.sessions.findById(id);
    if (!s) throw new NotFoundException('Session not found');
    return s;
  }

  private async notifyCohort(
    cohortId: string,
    title: string,
    when: Date,
  ): Promise<void> {
    try {
      const detail = await this.cohorts.getDetail(cohortId);
      await this.notifications.createMany(
        detail.students.map((s) => s.userId),
        {
          type: 'session',
          title: `Live session: ${title}`,
          body: `Scheduled for ${when.toUTCString()}`,
          link: '/app/live-sessions',
        },
      );
    } catch {
      // best-effort — a missing cohort shouldn't block scheduling.
    }
  }

  /** Deterministic AI recap from free-text notes (summary + key points + assignment). */
  private buildRecap(
    title: string,
    notes: string,
  ): NonNullable<LiveSessionDocument['recap']> {
    const clean = (notes ?? '').replace(/\s+/g, ' ').trim();
    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);
    const keyPoints = sentences.slice(0, 5);
    const summary = sentences.length
      ? `In "${title}", we covered ${sentences.length} key point${sentences.length === 1 ? '' : 's'}. ${sentences[0]}`
      : `Recap for "${title}". Add session notes to generate a detailed summary.`;
    return {
      summary,
      keyPoints,
      assignmentTitle: `Practice: ${title}`,
      assignmentDescription: sentences.length
        ? `Apply today's session by building a small exercise around: ${keyPoints[0]} Submit your work in Project Studio.`
        : `Write up your notes and build a small exercise applying "${title}".`,
      suggestedQuizTopic: title,
      generatedAt: new Date(),
    };
  }

  private meetingLink(): string {
    // Real, joinable video room on Jitsi Meet — no API key required. Override the base with
    // JITSI_BASE_URL (e.g. a self-hosted Jitsi) the same way PISTON_URL overrides code-exec.
    // The `asta-` prefix namespaces the room so it isn't trivially guessable/squatted.
    const base = (process.env.JITSI_BASE_URL ?? 'https://meet.jit.si').replace(
      /\/+$/,
      '',
    );
    const slug = new Types.ObjectId().toHexString();
    return `${base}/asta-${slug}`;
  }

  private view(s: LiveSessionDocument): SessionView {
    return {
      id: String(s._id),
      organizationId: String(s.organization),
      cohortId: s.cohort ? String(s.cohort) : undefined,
      title: s.title,
      description: s.description,
      hostId: String(s.host),
      hostName: s.hostName,
      scheduledStart: new Date(s.scheduledStart).toISOString(),
      durationMins: s.durationMins,
      status: s.status,
      meetingUrl: s.meetingUrl,
      attendeeCount: s.attendees?.length ?? 0,
    };
  }

  private detail(s: LiveSessionDocument): SessionDetail {
    return {
      ...this.view(s),
      notes: s.notes,
      attendees: (s.attendees ?? []).map((a) => ({
        userId: String(a.user),
        name: a.name,
        joinedAt: new Date(a.joinedAt).toISOString(),
      })),
      recap: s.recap
        ? {
            summary: s.recap.summary,
            keyPoints: s.recap.keyPoints,
            assignmentTitle: s.recap.assignmentTitle,
            assignmentDescription: s.recap.assignmentDescription,
            suggestedQuizTopic: s.recap.suggestedQuizTopic,
            generatedAt: s.recap.generatedAt
              ? new Date(s.recap.generatedAt).toISOString()
              : undefined,
          }
        : null,
    };
  }
}
