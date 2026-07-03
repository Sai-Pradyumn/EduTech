import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import {
  MarketplaceTemplate,
  MarketplaceTemplateDocument,
  TemplateType,
} from './schemas/marketplace-template.schema';
import {
  CreateTemplateDto,
  ReviewTemplateDto,
  UpdateTemplateDto,
} from './dto/marketplace.dto';
import { CloneResult, TemplateClonerService } from './template-cloner.service';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel(MarketplaceTemplate.name)
    private readonly model: Model<MarketplaceTemplateDocument>,
    private readonly users: UsersService,
    private readonly cloner: TemplateClonerService,
  ) {}

  /** Browse published templates with optional type/role filters. */
  async list(filters: {
    type?: string;
    targetRole?: string;
  }): Promise<Record<string, unknown>[]> {
    const q: FilterQuery<MarketplaceTemplateDocument> = { status: 'published' };
    if (filters.type) q.type = filters.type as TemplateType;
    if (filters.targetRole) q.targetRole = new RegExp(filters.targetRole, 'i');
    const list = await this.model
      .find(q)
      .sort({ usageCount: -1, createdAt: -1 })
      .limit(60)
      .exec();
    return Promise.all(list.map((t) => this.toView(t)));
  }

  async get(id: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Template not found');
    const t = await this.model.findById(id).exec();
    if (!t) throw new NotFoundException('Template not found');
    return this.toView(t, true);
  }

  /** Creator's own templates (any status). */
  async mine(userId: string): Promise<Record<string, unknown>[]> {
    const list = await this.model
      .find({ creator: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return Promise.all(list.map((t) => this.toView(t, true)));
  }

  /** Admin moderation queue. */
  async pending(): Promise<Record<string, unknown>[]> {
    const list = await this.model
      .find({ status: 'pending_review' })
      .sort({ createdAt: 1 })
      .exec();
    return Promise.all(list.map((t) => this.toView(t, true)));
  }

  async create(
    userId: string,
    dto: CreateTemplateDto,
  ): Promise<MarketplaceTemplateDocument> {
    return this.model.create({
      creator: new Types.ObjectId(userId),
      type: dto.type,
      title: dto.title,
      description: dto.description ?? '',
      tags: dto.tags ?? [],
      level: dto.level ?? 'beginner',
      targetRole: dto.targetRole ?? '',
      content: dto.content ?? {},
      status: 'draft',
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTemplateDto,
  ): Promise<MarketplaceTemplateDocument> {
    const t = await this.owned(userId, id);
    Object.assign(t, dto);
    await t.save();
    return t;
  }

  async submit(
    userId: string,
    id: string,
  ): Promise<MarketplaceTemplateDocument> {
    const t = await this.owned(userId, id);
    t.status = 'pending_review';
    await t.save();
    return t;
  }

  /** Admin: approve or reject a pending template. */
  async review(
    id: string,
    dto: ReviewTemplateDto,
  ): Promise<MarketplaceTemplateDocument> {
    const t = await this.model.findById(id).exec();
    if (!t) throw new NotFoundException('Template not found');
    t.status = dto.decision;
    t.reviewNote = dto.note ?? '';
    await t.save();
    return t;
  }

  /**
   * "Use" a template — actually CLONES it into a real personal asset (via the
   * asset's own generation pipeline), records the usage, and returns a deep link
   * to the created asset. Previously this only bumped a counter and returned a
   * generic route, so the consumer landed on an empty screen (MARKET-BUG-001).
   */
  async use(
    userId: string,
    id: string,
  ): Promise<{ ok: true; type: TemplateType } & CloneResult> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Template not available');
    const t = await this.model.findById(id).exec();
    if (!t || t.status !== 'published')
      throw new NotFoundException('Template not available');
    // Clone first — a generation failure must not count as a use.
    const clone = await this.cloner.clone(userId, t);
    t.usageCount += 1;
    await t.save();
    return { ok: true, type: t.type, ...clone };
  }

  private async owned(
    userId: string,
    id: string,
  ): Promise<MarketplaceTemplateDocument> {
    const t = await this.model
      .findOne({
        _id: new Types.ObjectId(id),
        creator: new Types.ObjectId(userId),
      })
      .exec();
    if (!t) throw new ForbiddenException('Not your template');
    return t;
  }

  private async toView(
    t: MarketplaceTemplateDocument,
    full = false,
  ): Promise<Record<string, unknown>> {
    const u = await this.users.findById(String(t.creator)).catch(() => null);
    return {
      id: String(t._id),
      type: t.type,
      title: t.title,
      description: t.description,
      tags: t.tags,
      level: t.level,
      targetRole: t.targetRole,
      creatorName: u?.name ?? 'Creator',
      status: t.status,
      usageCount: t.usageCount,
      rating: t.ratingSummary,
      reviewNote: t.reviewNote,
      ...(full ? { content: t.content } : {}),
    };
  }
}
