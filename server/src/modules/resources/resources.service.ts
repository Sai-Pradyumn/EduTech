import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoadmapStatus } from '../../common/enums';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { RESOURCE_CATALOG } from './resource-catalog';
import {
  ProgressStatus,
  Resource,
  ResourceDocument,
  ResourceKind,
  ResourceLevel,
  ResourceProgress,
  ResourceProgressDocument,
} from './schemas/resource.schema';

export interface ResourceView {
  id: string;
  title: string;
  url: string;
  provider: string;
  kind: ResourceKind;
  topics: string[];
  level: ResourceLevel;
  minutes: number;
  free: boolean;
  description: string;
  /** The learner's saved/in_progress/done state, when known. */
  progress: ProgressStatus | null;
  upvotes: number;
  hasUpvoted: boolean;
  /** 'pending' only ever appears on the submitter's own suggestions. */
  status: 'approved' | 'pending';
  /** For-you only: why this was picked for the learner. */
  reason?: string;
}

interface LearnerSignal {
  terms: Set<string>;
  weakTerms: Set<string>;
  goalText: string;
  weekFocus: string;
  level?: string;
}

/**
 * Curated learning resources, matched to the learner. The shipped catalog seeds
 * idempotently on boot (only when the collection is empty), so every deployment
 * has real content; admins can curate the collection afterwards. "For you"
 * ranks by term overlap with the learner's goal, skills, weak areas and the
 * active roadmap week — weak-area matches win and say so.
 */
@Injectable()
export class ResourcesService implements OnModuleInit {
  private readonly logger = new Logger(ResourcesService.name);

  constructor(
    @InjectModel(Resource.name)
    private readonly resources: Model<ResourceDocument>,
    @InjectModel(ResourceProgress.name)
    private readonly progress: Model<ResourceProgressDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    private readonly profiles: StudentProfileService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const count = await this.resources.estimatedDocumentCount().exec();
      if (count === 0) {
        await this.resources.insertMany(RESOURCE_CATALOG);
        this.logger.log(
          `Seeded the resource catalog (${RESOURCE_CATALOG.length} entries).`,
        );
      }
    } catch (err) {
      // Never block boot on catalog seeding (e.g. transient DB hiccup).
      this.logger.warn(`Catalog seed skipped: ${(err as Error).message}`);
    }
  }

  async list(
    userId: string,
    filter: {
      topic?: string;
      kind?: ResourceKind;
      level?: ResourceLevel;
      q?: string;
    },
  ): Promise<ResourceView[]> {
    const query: Record<string, unknown> = {};
    if (filter.kind) query.kind = filter.kind;
    if (filter.level) query.level = filter.level;
    if (filter.topic) query.topics = filter.topic.toLowerCase();
    // Pending community submissions are visible only to their submitter.
    const conditions: Record<string, unknown>[] = [
      {
        $or: [
          { status: { $ne: 'pending' } },
          { submittedBy: new Types.ObjectId(userId) },
        ],
      },
    ];
    if (filter.q?.trim()) {
      const rx = new RegExp(this.escapeRegex(filter.q.trim()), 'i');
      conditions.push({
        $or: [{ title: rx }, { description: rx }, { provider: rx }, { topics: rx }],
      });
    }
    query.$and = conditions;
    const docs = await this.resources
      .find(query)
      .sort({ quality: -1, title: 1 })
      .limit(100)
      .lean()
      .exec();
    return this.withProgress(userId, docs);
  }

  /** Resources matched to this learner's goal, skills, weak areas and current week. */
  async forYou(userId: string, limit = 12): Promise<ResourceView[]> {
    const signal = await this.learnerSignal(userId);
    // Never recommend unreviewed community submissions.
    const docs = await this.resources
      .find({ status: { $ne: 'pending' } })
      .lean()
      .exec();

    const scored = docs
      .map((doc) => {
        const hay = new Set([
          ...doc.topics.map((t) => t.toLowerCase()),
          ...this.tokenize(`${doc.title} ${doc.description}`),
        ]);
        let score = 0;
        let reason = '';
        // Weak areas beat everything: that's where a mentor points you first.
        for (const t of signal.weakTerms) {
          if (hay.has(t)) {
            score += 3;
            if (!reason) reason = `targets your weak area: ${t}`;
          }
        }
        for (const t of signal.terms) {
          if (hay.has(t)) {
            score += 1;
            if (!reason) reason = `matches your goal: ${signal.goalText}`;
          }
        }
        if (signal.weekFocus) {
          const focusTerms = this.tokenize(signal.weekFocus);
          if (focusTerms.some((t) => hay.has(t))) {
            score += 2;
            reason = `this week's focus: ${signal.weekFocus}`;
          }
        }
        if (signal.level && doc.level === signal.level) score += 0.5;
        score += (doc.quality ?? 70) / 200; // quality only breaks ties
        return { doc, score, reason };
      })
      .filter((r) => r.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const views = await this.withProgress(
      userId,
      scored.map((s) => s.doc),
    );
    return views.map((v, i) => ({ ...v, reason: scored[i].reason }));
  }

  /** The learner's library: everything they saved/started/finished. */
  async library(userId: string): Promise<ResourceView[]> {
    const rows = await this.progress
      .find({ user: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (rows.length === 0) return [];
    const docs = await this.resources
      .find({ _id: { $in: rows.map((r) => r.resource) } })
      .lean()
      .exec();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    return rows
      .filter((r) => byId.has(String(r.resource)))
      .map((r) => this.toView(byId.get(String(r.resource))!, r.status, userId));
  }

  async setProgress(
    userId: string,
    resourceId: string,
    status: ProgressStatus,
  ): Promise<ResourceView> {
    const doc = await this.resources.findById(resourceId).lean().exec();
    if (!doc) throw new NotFoundException('Resource not found');
    await this.progress
      .updateOne(
        {
          user: new Types.ObjectId(userId),
          resource: new Types.ObjectId(resourceId),
        },
        { $set: { status } },
        { upsert: true },
      )
      .exec();
    return this.toView(doc, status, userId);
  }

  async clearProgress(userId: string, resourceId: string): Promise<void> {
    await this.progress
      .deleteOne({
        user: new Types.ObjectId(userId),
        resource: new Types.ObjectId(resourceId),
      })
      .exec();
  }

  // ── community submissions + upvotes ─────────────────────────

  /** Suggest a resource for the catalog — lands as 'pending' until an admin approves. */
  async suggest(
    userId: string,
    input: {
      title: string;
      url: string;
      provider: string;
      kind: ResourceKind;
      level: ResourceLevel;
      topics: string[];
      minutes?: number;
      description?: string;
      free?: boolean;
    },
  ): Promise<ResourceView> {
    const existing = await this.resources
      .findOne({ url: input.url.trim() })
      .lean()
      .exec();
    if (existing) {
      throw new BadRequestException('That link is already in the catalog.');
    }
    const doc = await this.resources.create({
      title: input.title.trim(),
      url: input.url.trim(),
      provider: input.provider.trim(),
      kind: input.kind,
      level: input.level,
      topics: input.topics.map((t) => t.trim().toLowerCase()).filter(Boolean),
      minutes: input.minutes ?? 0,
      free: input.free ?? true,
      description: (input.description ?? '').trim(),
      quality: 50, // community submissions start below curated entries
      status: 'pending',
      submittedBy: new Types.ObjectId(userId),
    });
    return this.toView(doc.toObject(), null, userId);
  }

  async toggleUpvote(userId: string, resourceId: string): Promise<ResourceView> {
    if (!Types.ObjectId.isValid(resourceId))
      throw new NotFoundException('Resource not found');
    const doc = await this.resources.findById(resourceId).exec();
    if (!doc) throw new NotFoundException('Resource not found');
    const idx = doc.upvotes.findIndex((v) => String(v) === userId);
    if (idx >= 0) doc.upvotes.splice(idx, 1);
    else doc.upvotes.push(new Types.ObjectId(userId));
    await doc.save();
    return this.toView(doc.toObject(), null, userId);
  }

  /** Admin review queue: pending community submissions, oldest first. */
  async pending(viewerId: string): Promise<ResourceView[]> {
    const docs = await this.resources
      .find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean()
      .exec();
    return docs.map((d) => this.toView(d, null, viewerId));
  }

  async approve(viewerId: string, resourceId: string): Promise<ResourceView> {
    if (!Types.ObjectId.isValid(resourceId))
      throw new NotFoundException('Resource not found');
    const doc = await this.resources
      .findByIdAndUpdate(resourceId, { $set: { status: 'approved' } }, { new: true })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Resource not found');
    return this.toView(doc, null, viewerId);
  }

  /** Reject (delete) a pending submission; approved catalog entries are untouchable here. */
  async reject(resourceId: string): Promise<{ ok: true }> {
    if (!Types.ObjectId.isValid(resourceId))
      throw new NotFoundException('Resource not found');
    const res = await this.resources
      .deleteOne({ _id: resourceId, status: 'pending' })
      .exec();
    if (res.deletedCount === 0)
      throw new NotFoundException('Pending submission not found');
    return { ok: true };
  }

  // ───────────────────────── internals ─────────────────────────

  private async learnerSignal(userId: string): Promise<LearnerSignal> {
    const [profile, roadmap] = await Promise.all([
      this.profiles.findByUser(userId),
      this.roadmaps
        .findOne({
          user: new Types.ObjectId(userId),
          status: RoadmapStatus.Active,
        })
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
    ]);
    const currentWeek = roadmap?.weeklyPlan?.find(
      (w) => !roadmap.completedWeeks?.includes(w.weekNumber),
    );
    const goalText = profile?.mainGoal ?? '';
    return {
      terms: new Set([
        ...this.tokenize(goalText),
        ...this.tokenize(profile?.careerTarget ?? ''),
        ...(profile?.currentSkills ?? []).flatMap((s) => this.tokenize(s)),
        ...this.tokenize(roadmap?.goal ?? ''),
      ]),
      weakTerms: new Set(
        (profile?.weakAreas ?? []).flatMap((s) => this.tokenize(s)),
      ),
      goalText: goalText || 'your goal',
      weekFocus: currentWeek?.focus ?? '',
      level: profile?.currentSkillLevel,
    };
  }

  private async withProgress(
    userId: string,
    docs: (Resource & { _id: unknown })[],
  ): Promise<ResourceView[]> {
    if (docs.length === 0) return [];
    const rows = await this.progress
      .find({
        user: new Types.ObjectId(userId),
        resource: { $in: docs.map((d) => d._id) },
      })
      .lean()
      .exec();
    const status = new Map(rows.map((r) => [String(r.resource), r.status]));
    return docs.map((d) =>
      this.toView(d, status.get(String(d._id)) ?? null, userId),
    );
  }

  private toView(
    d: Resource & { _id: unknown },
    progress: ProgressStatus | null,
    viewerId: string,
  ): ResourceView {
    const upvotes = d.upvotes ?? [];
    return {
      id: String(d._id),
      title: d.title,
      url: d.url,
      provider: d.provider,
      kind: d.kind,
      topics: d.topics,
      level: d.level,
      minutes: d.minutes,
      free: d.free,
      description: d.description,
      progress,
      upvotes: upvotes.length,
      hasUpvoted: upvotes.some((v) => String(v) === viewerId),
      status: d.status === 'pending' ? 'pending' : 'approved',
    };
  }

  private tokenize(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).filter(
      (t) => t.length > 1 && !STOP.has(t),
    );
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

const STOP = new Set([
  'a',
  'an',
  'and',
  'the',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'my',
  'be',
  'become',
  'becoming',
  'developer',
  'engineer',
  'land',
  'get',
  'job',
  'internship',
  'learn',
  'learning',
  'stack',
]);
