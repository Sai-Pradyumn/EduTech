import {
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
    if (filter.q?.trim()) {
      const rx = new RegExp(this.escapeRegex(filter.q.trim()), 'i');
      query.$or = [
        { title: rx },
        { description: rx },
        { provider: rx },
        { topics: rx },
      ];
    }
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
    const docs = await this.resources.find().lean().exec();

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
      .map((r) => this.toView(byId.get(String(r.resource))!, r.status));
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
    return this.toView(doc, status);
  }

  async clearProgress(userId: string, resourceId: string): Promise<void> {
    await this.progress
      .deleteOne({
        user: new Types.ObjectId(userId),
        resource: new Types.ObjectId(resourceId),
      })
      .exec();
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
    return docs.map((d) => this.toView(d, status.get(String(d._id)) ?? null));
  }

  private toView(
    d: Resource & { _id: unknown },
    progress: ProgressStatus | null,
  ): ResourceView {
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
