import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProjectsService } from '../../projects/services/projects.service';
import {
  ChannelKind,
  CommunityChannel,
  CommunityChannelDocument,
  CommunityReply,
  CommunityReplyDocument,
  CommunityReport,
  CommunityReportDocument,
  CommunityThread,
  CommunityThreadDocument,
  ThreadKind,
} from '../schemas/community.schema';
import { CreateChannelDto, CreateThreadDto } from '../dto/community.dto';

export interface ChannelView {
  id: string;
  name: string;
  slug: string;
  description: string;
  kind: ChannelKind;
  threadCount: number;
}

export interface ThreadView {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  kind: ThreadKind;
  tags: string[];
  projectId?: string;
  projectTitle?: string;
  upvotes: number;
  hasUpvoted: boolean;
  replyCount: number;
  resolved: boolean;
  pinned: boolean;
  createdAt: string;
}

export interface ReplyView {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  upvotes: number;
  hasUpvoted: boolean;
  isAnswer: boolean;
  createdAt: string;
}

export interface ReportView {
  id: string;
  threadId: string;
  replyId?: string;
  threadTitle: string;
  preview: string;
  reporterName: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

const DEFAULT_CHANNELS: {
  name: string;
  slug: string;
  description: string;
  kind: ChannelKind;
}[] = [
  {
    name: 'General',
    slug: 'general',
    description: 'Introductions and general discussion.',
    kind: 'discussion',
  },
  {
    name: 'Help & Doubts',
    slug: 'help',
    description: 'Ask questions and get unblocked.',
    kind: 'help',
  },
  {
    name: 'Showcase',
    slug: 'showcase',
    description: 'Share what you built.',
    kind: 'showcase',
  },
];

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel(CommunityChannel.name)
    private readonly channels: Model<CommunityChannelDocument>,
    @InjectModel(CommunityThread.name)
    private readonly threads: Model<CommunityThreadDocument>,
    @InjectModel(CommunityReply.name)
    private readonly replies: Model<CommunityReplyDocument>,
    @InjectModel(CommunityReport.name)
    private readonly reports: Model<CommunityReportDocument>,
    private readonly projects: ProjectsService,
  ) {}

  // ── channels ───────────────────────────────────────────────────────────────
  /** List org channels, lazily seeding the defaults on first access. */
  async listChannels(orgId: string): Promise<ChannelView[]> {
    const org = new Types.ObjectId(orgId);
    let list = await this.channels
      .find({ organization: org })
      .sort({ createdAt: 1 })
      .lean<CommunityChannelDocument[]>()
      .exec();
    if (list.length === 0) {
      await this.channels
        .insertMany(
          DEFAULT_CHANNELS.map((c) => ({
            ...c,
            organization: org,
            threadCount: 0,
          })),
          { ordered: false },
        )
        .catch(() => undefined);
      list = await this.channels
        .find({ organization: org })
        .sort({ createdAt: 1 })
        .lean<CommunityChannelDocument[]>()
        .exec();
    }
    return list.map((c) => this.channelView(c));
  }

  async createChannel(
    orgId: string,
    userId: string,
    dto: CreateChannelDto,
  ): Promise<ChannelView> {
    const slug = this.slugify(dto.name);
    const existing = await this.channels
      .findOne({ organization: new Types.ObjectId(orgId), slug })
      .lean()
      .exec();
    if (existing)
      throw new BadRequestException('A channel with that name already exists.');
    const c = await this.channels.create({
      organization: new Types.ObjectId(orgId),
      name: dto.name,
      slug,
      description: dto.description ?? '',
      kind: dto.kind ?? 'discussion',
      createdBy: new Types.ObjectId(userId),
    });
    return this.channelView(c);
  }

  async orgIdOfChannel(channelId: string): Promise<string> {
    const c = await this.channels
      .findById(channelId)
      .select('organization')
      .lean<{ organization: Types.ObjectId }>()
      .exec();
    if (!c) throw new NotFoundException('Channel not found');
    return String(c.organization);
  }

  async orgIdOfThread(threadId: string): Promise<string> {
    const t = await this.threads
      .findById(threadId)
      .select('organization')
      .lean<{ organization: Types.ObjectId }>()
      .exec();
    if (!t) throw new NotFoundException('Thread not found');
    return String(t.organization);
  }

  // ── threads ────────────────────────────────────────────────────────────────
  async listThreads(
    channelId: string,
    viewerId: string,
  ): Promise<ThreadView[]> {
    const list = await this.threads
      .find({ channel: new Types.ObjectId(channelId) })
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(100)
      .lean<CommunityThreadDocument[]>()
      .exec();
    return list.map((t) => this.threadView(t, viewerId));
  }

  async createThread(
    orgId: string,
    userId: string,
    authorName: string,
    dto: CreateThreadDto,
  ): Promise<ThreadView> {
    const channel = await this.channels.findById(dto.channelId).exec();
    if (!channel) throw new NotFoundException('Channel not found');

    let project: Types.ObjectId | undefined;
    let projectTitle = '';
    if (dto.projectId) {
      // Confirms the showcasing user owns the project (throws otherwise) and grabs its title.
      const p = await this.projects.get(userId, dto.projectId);
      project = p._id;
      projectTitle = p.title;
    }

    const thread = await this.threads.create({
      channel: channel._id,
      organization: new Types.ObjectId(orgId),
      author: new Types.ObjectId(userId),
      authorName,
      title: dto.title,
      body: dto.body ?? '',
      kind:
        dto.kind ??
        (channel.kind === 'help'
          ? 'question'
          : channel.kind === 'showcase'
            ? 'showcase'
            : 'discussion'),
      tags: dto.tags ?? [],
      project,
      projectTitle,
    });
    await this.channels
      .updateOne({ _id: channel._id }, { $inc: { threadCount: 1 } })
      .exec();
    return this.threadView(thread, userId);
  }

  async getThread(
    threadId: string,
    viewerId: string,
  ): Promise<{ thread: ThreadView; replies: ReplyView[] }> {
    const thread = await this.threadDoc(threadId);
    const replies = await this.replies
      .find({ thread: thread._id })
      .sort({ isAnswer: -1, createdAt: 1 })
      .lean<CommunityReplyDocument[]>()
      .exec();
    return {
      thread: this.threadView(thread, viewerId),
      replies: replies.map((r) => this.replyView(r, viewerId)),
    };
  }

  async toggleThreadUpvote(
    threadId: string,
    userId: string,
  ): Promise<ThreadView> {
    const thread = await this.threadDoc(threadId);
    this.toggleVote(thread.upvotes, userId);
    await thread.save();
    return this.threadView(thread, userId);
  }

  async deleteThread(
    threadId: string,
    userId: string,
    canModerate: boolean,
  ): Promise<{ ok: true }> {
    const thread = await this.threadDoc(threadId);
    if (!canModerate && String(thread.author) !== userId)
      throw new ForbiddenException('You can only delete your own threads.');
    await this.replies.deleteMany({ thread: thread._id }).exec();
    await this.threads.deleteOne({ _id: thread._id }).exec();
    await this.channels
      .updateOne({ _id: thread.channel }, { $inc: { threadCount: -1 } })
      .exec();
    return { ok: true };
  }

  // ── replies ──────────────────────────────────────────────────────────────
  async addReply(
    threadId: string,
    userId: string,
    authorName: string,
    body: string,
  ): Promise<ReplyView> {
    const thread = await this.threadDoc(threadId);
    const reply = await this.replies.create({
      thread: thread._id,
      author: new Types.ObjectId(userId),
      authorName,
      body,
    });
    thread.replyCount += 1;
    await thread.save();
    return this.replyView(reply, userId);
  }

  async toggleReplyUpvote(replyId: string, userId: string): Promise<ReplyView> {
    const reply = await this.replyDoc(replyId);
    this.toggleVote(reply.upvotes, userId);
    await reply.save();
    return this.replyView(reply, userId);
  }

  /** Thread author (or a moderator) accepts a reply as the answer; marks the thread resolved. */
  async acceptAnswer(
    replyId: string,
    userId: string,
    canModerate: boolean,
  ): Promise<{ ok: true }> {
    const reply = await this.replyDoc(replyId);
    const thread = await this.threadDoc(String(reply.thread));
    if (!canModerate && String(thread.author) !== userId)
      throw new ForbiddenException(
        'Only the thread author can accept an answer.',
      );
    await this.replies
      .updateMany({ thread: thread._id }, { $set: { isAnswer: false } })
      .exec();
    reply.isAnswer = true;
    await reply.save();
    thread.resolved = true;
    await thread.save();
    return { ok: true };
  }

  async deleteReply(
    replyId: string,
    userId: string,
    canModerate: boolean,
  ): Promise<{ ok: true }> {
    const reply = await this.replyDoc(replyId);
    if (!canModerate && String(reply.author) !== userId)
      throw new ForbiddenException('You can only delete your own replies.');
    await this.replies.deleteOne({ _id: reply._id }).exec();
    await this.threads
      .updateOne({ _id: reply.thread }, { $inc: { replyCount: -1 } })
      .exec();
    return { ok: true };
  }

  // ── moderation reports ────────────────────────────────────────────────────

  /** Flag a thread (or a reply in it). One open report per reporter+target. */
  async report(
    orgId: string,
    userId: string,
    userName: string,
    input: { threadId: string; replyId?: string; reason?: string },
  ): Promise<{ ok: true; duplicate: boolean }> {
    const thread = await this.threadDoc(input.threadId);
    let reply: CommunityReplyDocument | null = null;
    if (input.replyId) {
      reply = await this.replyDoc(input.replyId);
      if (String(reply.thread) !== String(thread._id))
        throw new BadRequestException('That reply is not in this thread.');
    }
    const preview = (reply ? reply.body : `${thread.title} — ${thread.body}`)
      .replace(/\s+/g, ' ')
      .slice(0, 160);

    const existing = await this.reports
      .findOne({
        reporter: new Types.ObjectId(userId),
        thread: thread._id,
        status: 'open',
        ...(reply ? { reply: reply._id } : { reply: { $exists: false } }),
      })
      .lean()
      .exec();
    if (existing) return { ok: true, duplicate: true };

    await this.reports.create({
      organization: new Types.ObjectId(orgId),
      thread: thread._id,
      ...(reply ? { reply: reply._id } : {}),
      reporter: new Types.ObjectId(userId),
      reporterName: userName,
      reason: (input.reason ?? '').trim().slice(0, 300),
      threadTitle: thread.title,
      preview,
    });
    return { ok: true, duplicate: false };
  }

  /** Moderator queue: open reports first (newest), then recent resolved ones. */
  async listReports(orgId: string): Promise<ReportView[]> {
    const list = await this.reports
      .find({ organization: new Types.ObjectId(orgId) })
      .sort({ status: 1, createdAt: -1 }) // 'open' < 'resolved'
      .limit(50)
      .lean<CommunityReportDocument[]>()
      .exec();
    return list.map((r) => ({
      id: String(r._id),
      threadId: String(r.thread),
      replyId: r.reply ? String(r.reply) : undefined,
      threadTitle: r.threadTitle,
      preview: r.preview,
      reporterName: r.reporterName,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt?.toISOString() ?? '',
    }));
  }

  async resolveReport(orgId: string, id: string): Promise<{ ok: true }> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Report not found');
    const res = await this.reports
      .updateOne(
        { _id: id, organization: new Types.ObjectId(orgId) },
        { $set: { status: 'resolved' } },
      )
      .exec();
    if (res.matchedCount === 0) throw new NotFoundException('Report not found');
    return { ok: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private async threadDoc(id: string): Promise<CommunityThreadDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Thread not found');
    const t = await this.threads.findById(id);
    if (!t) throw new NotFoundException('Thread not found');
    return t;
  }

  private async replyDoc(id: string): Promise<CommunityReplyDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Reply not found');
    const r = await this.replies.findById(id);
    if (!r) throw new NotFoundException('Reply not found');
    return r;
  }

  private toggleVote(votes: Types.ObjectId[], userId: string): void {
    const idx = votes.findIndex((v) => String(v) === userId);
    if (idx >= 0) votes.splice(idx, 1);
    else votes.push(new Types.ObjectId(userId));
  }

  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'channel'
    );
  }

  private channelView(c: CommunityChannelDocument): ChannelView {
    return {
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      description: c.description,
      kind: c.kind,
      threadCount: c.threadCount ?? 0,
    };
  }

  private threadView(t: CommunityThreadDocument, viewerId: string): ThreadView {
    return {
      id: String(t._id),
      channelId: String(t.channel),
      authorId: String(t.author),
      authorName: t.authorName,
      title: t.title,
      body: t.body,
      kind: t.kind,
      tags: t.tags,
      projectId: t.project ? String(t.project) : undefined,
      projectTitle: t.projectTitle || undefined,
      upvotes: t.upvotes.length,
      hasUpvoted: t.upvotes.some((v) => String(v) === viewerId),
      replyCount: t.replyCount,
      resolved: t.resolved,
      pinned: t.pinned,
      createdAt:
        (
          t as CommunityThreadDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }

  private replyView(r: CommunityReplyDocument, viewerId: string): ReplyView {
    return {
      id: String(r._id),
      authorId: String(r.author),
      authorName: r.authorName,
      body: r.body,
      upvotes: r.upvotes.length,
      hasUpvoted: r.upvotes.some((v) => String(v) === viewerId),
      isAnswer: r.isAnswer,
      createdAt:
        (
          r as CommunityReplyDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }
}
