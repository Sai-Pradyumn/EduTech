import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  MentorProfile,
  MentorProfileDocument,
} from './schemas/mentor-profile.schema';
import {
  MentorSession,
  MentorSessionDocument,
  MentorSessionStatus,
} from './schemas/mentor-session.schema';
import {
  RequestSessionDto,
  UpsertMentorProfileDto,
} from './dto/mentor-marketplace.dto';

export interface MentorView {
  id: string;
  name: string;
  headline: string;
  expertise: string[];
  bio: string;
  availability: string;
  pricingMode: string;
  priceNote: string;
  rating: { avg: number; count: number };
}

export interface SessionView {
  id: string;
  type: string;
  status: string;
  message: string;
  notes: string;
  role: 'student' | 'mentor';
  counterpartName: string;
  linkedProjectId: string | null;
  scheduledAt: string | null;
  createdAt: string;
}

/**
 * The session lifecycle as a strict state machine — a request can only move along
 * these edges (was: any status → any status). Terminal states have no outgoing edges.
 */
const SESSION_TRANSITIONS: Record<MentorSessionStatus, MentorSessionStatus[]> =
  {
    requested: ['accepted', 'cancelled'],
    accepted: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

@Injectable()
export class MentorMarketplaceService {
  constructor(
    @InjectModel(MentorProfile.name)
    private readonly profiles: Model<MentorProfileDocument>,
    @InjectModel(MentorSession.name)
    private readonly sessions: Model<MentorSessionDocument>,
    private readonly users: UsersService,
    private readonly ledger: LedgerService,
  ) {}

  // ── profiles ──
  /**
   * Browsable mentors for `viewerId`: never your own profile, and `org`-visible
   * profiles only when the viewer shares that org — so org-only mentors no longer
   * leak into the public list.
   */
  async listMentors(viewerId: string): Promise<MentorView[]> {
    const viewer = await this.users.findById(viewerId).catch(() => null);
    const viewerOrg = viewer?.primaryOrganization
      ? String(viewer.primaryOrganization)
      : null;
    const list = await this.profiles
      .find()
      .sort({ 'ratingSummary.avg': -1, createdAt: -1 })
      .limit(120)
      .exec();
    const visible = list.filter((p) => {
      if (String(p.user) === viewerId) return false; // not yourself
      if (p.visibility === 'public') return true;
      return (
        !!viewerOrg && !!p.organization && String(p.organization) === viewerOrg
      );
    });
    return Promise.all(visible.slice(0, 60).map((p) => this.toMentorView(p)));
  }

  async getMentor(id: string): Promise<MentorView> {
    const p = await this.profiles.findById(id).exec();
    if (!p) throw new NotFoundException('Mentor not found');
    return this.toMentorView(p);
  }

  async myProfile(userId: string): Promise<MentorProfileDocument | null> {
    return this.profiles.findOne({ user: new Types.ObjectId(userId) }).exec();
  }

  async upsertProfile(
    userId: string,
    dto: UpsertMentorProfileDto,
  ): Promise<MentorProfileDocument> {
    // Stamp the mentor's org so `org` visibility can be enforced on the list.
    const self = await this.users.findById(userId).catch(() => null);
    const update = {
      headline: dto.headline,
      expertise: dto.expertise ?? [],
      bio: dto.bio ?? '',
      availability: dto.availability ?? 'Flexible — request a slot',
      pricingMode: dto.pricingMode ?? 'free',
      priceNote: dto.priceNote ?? '',
      visibility: dto.visibility ?? 'public',
      organization: self?.primaryOrganization ?? undefined,
    };
    await this.profiles
      .updateOne(
        { user: new Types.ObjectId(userId) },
        { $set: { user: new Types.ObjectId(userId), ...update } },
        { upsert: true },
      )
      .exec();
    return (await this.myProfile(userId))!;
  }

  // ── sessions ──
  async requestSession(
    studentId: string,
    dto: RequestSessionDto,
  ): Promise<MentorSessionDocument> {
    const profile = await this.profiles.findById(dto.mentorId).exec();
    if (!profile) throw new NotFoundException('Mentor not found');
    // You can't mentor yourself.
    if (String(profile.user) === studentId)
      throw new BadRequestException(
        "You can't request a session with your own mentor profile.",
      );
    // One open request per student↔mentor pair — no spamming the same mentor.
    const open = await this.sessions
      .findOne({
        mentor: profile.user,
        student: new Types.ObjectId(studentId),
        status: { $in: ['requested', 'accepted'] },
      })
      .exec();
    if (open)
      throw new BadRequestException(
        'You already have an open session with this mentor — wait for it to finish first.',
      );
    return this.sessions.create({
      mentor: profile.user,
      student: new Types.ObjectId(studentId),
      type: dto.type,
      message: dto.message ?? '',
      linkedProjectId: dto.linkedProjectId,
      linkedPortfolioUsername: dto.linkedPortfolioUsername,
      status: 'requested',
    });
  }

  async listSessions(userId: string): Promise<SessionView[]> {
    const uid = new Types.ObjectId(userId);
    const list = await this.sessions
      .find({ $or: [{ student: uid }, { mentor: uid }] })
      .sort({ createdAt: -1 })
      .limit(60)
      .exec();
    return Promise.all(
      list.map(async (s) => {
        const isStudent = String(s.student) === userId;
        const counterpartId = isStudent ? s.mentor : s.student;
        const counterpart = await this.users
          .findById(String(counterpartId))
          .catch(() => null);
        return {
          id: String(s._id),
          type: s.type,
          status: s.status,
          message: s.message,
          notes: s.notes,
          role: isStudent ? ('student' as const) : ('mentor' as const),
          counterpartName: counterpart?.name ?? 'Unknown',
          linkedProjectId: s.linkedProjectId ?? null,
          scheduledAt: s.scheduledAt?.toISOString() ?? null,
          createdAt:
            (
              s as MentorSessionDocument & { createdAt?: Date }
            ).createdAt?.toISOString() ?? '',
        };
      }),
    );
  }

  async updateStatus(
    userId: string,
    id: string,
    status: MentorSessionStatus,
    scheduledAt?: string,
  ): Promise<MentorSessionDocument> {
    const session = await this.ownedAny(userId, id);
    const isMentor = String(session.mentor) === userId;
    // Enforce the lifecycle: only edges in the state machine are allowed, so a
    // request can't jump straight to completed or move out of a terminal state.
    if (!SESSION_TRANSITIONS[session.status].includes(status))
      throw new BadRequestException(
        `A ${session.status} session can't be moved to ${status}.`,
      );
    // Accepting + completing are the mentor's calls; either party may cancel.
    if ((status === 'accepted' || status === 'completed') && !isMentor)
      throw new ForbiddenException(
        'Only the mentor can accept or complete a session.',
      );
    session.status = status;
    if (status === 'accepted' && scheduledAt) {
      const when = new Date(scheduledAt);
      if (!Number.isNaN(when.getTime())) session.scheduledAt = when;
    }
    await session.save();
    if (status === 'completed') {
      const mentor = await this.users
        .findById(String(session.mentor))
        .catch(() => null);
      await this.ledger.record(String(session.student), {
        kind: 'mentor_feedback_added',
        title: `Mentor review completed${mentor ? ` with ${mentor.name}` : ''}`,
        detail: `${this.typeLabel(session.type)}${session.notes ? ` — ${session.notes.slice(0, 140)}` : ''}`,
        verificationLevel: 'mentor',
      });
    }
    return session;
  }

  async addNotes(
    userId: string,
    id: string,
    notes: string,
  ): Promise<MentorSessionDocument> {
    const session = await this.ownedAny(userId, id);
    if (String(session.mentor) !== userId)
      throw new ForbiddenException('Only the mentor can add notes.');
    session.notes = notes;
    await session.save();
    return session;
  }

  private async ownedAny(
    userId: string,
    id: string,
  ): Promise<MentorSessionDocument> {
    const uid = new Types.ObjectId(userId);
    const session = await this.sessions
      .findOne({
        _id: new Types.ObjectId(id),
        $or: [{ student: uid }, { mentor: uid }],
      })
      .exec();
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async toMentorView(p: MentorProfileDocument): Promise<MentorView> {
    const u = await this.users.findById(String(p.user)).catch(() => null);
    return {
      id: String(p._id),
      name: u?.name ?? 'Mentor',
      headline: p.headline,
      expertise: p.expertise,
      bio: p.bio,
      availability: p.availability,
      pricingMode: p.pricingMode,
      priceNote: p.priceNote,
      rating: p.ratingSummary,
    };
  }

  private typeLabel(t: string): string {
    return t.replace(/_/g, ' ');
  }
}
