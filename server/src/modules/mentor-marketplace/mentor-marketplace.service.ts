import {
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
  createdAt: string;
}

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
  async listMentors(): Promise<MentorView[]> {
    const list = await this.profiles
      .find()
      .sort({ 'ratingSummary.avg': -1, createdAt: -1 })
      .limit(60)
      .exec();
    return Promise.all(list.map((p) => this.toMentorView(p)));
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
    const update = {
      headline: dto.headline,
      expertise: dto.expertise ?? [],
      bio: dto.bio ?? '',
      availability: dto.availability ?? 'Flexible — request a slot',
      pricingMode: dto.pricingMode ?? 'free',
      priceNote: dto.priceNote ?? '',
      visibility: dto.visibility ?? 'public',
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
  ): Promise<MentorSessionDocument> {
    const session = await this.ownedAny(userId, id);
    const isMentor = String(session.mentor) === userId;
    // Students may only cancel; mentors may accept/complete/cancel.
    if (!isMentor && status !== 'cancelled')
      throw new ForbiddenException('Only the mentor can change this status.');
    session.status = status;
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
