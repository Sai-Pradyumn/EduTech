import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FlowsService } from '../flows/flows.service';
import { VisualExplainerService } from './visual-explainer/visual-explainer.service';
import { VisualGenInput } from './visual-explainer/generated-visual.types';
import { VisualAsset, VisualAssetDocument } from './schemas/visual-asset.schema';
import { FromFlowNodeDto, GenerateVisualDto } from './dto/visual.dto';

@Injectable()
export class VisualsService {
  constructor(
    @InjectModel(VisualAsset.name) private readonly model: Model<VisualAssetDocument>,
    private readonly explainer: VisualExplainerService,
    private readonly flows: FlowsService,
  ) {}

  async generate(userId: string, dto: GenerateVisualDto): Promise<VisualAssetDocument> {
    const input: VisualGenInput = {
      concept: dto.concept.trim(),
      prompt: dto.prompt,
      type: dto.type,
      level: dto.level,
    };
    const v = await this.explainer.generate(userId, input);
    return this.model.create({
      user: new Types.ObjectId(userId),
      type: v.type,
      title: dto.concept.trim().slice(0, 160),
      prompt: dto.prompt ?? dto.concept.trim(),
      sourceType: dto.sourceType ?? 'manual',
      sourceId: dto.sourceId,
      contentFormat: v.contentFormat,
      content: v.content,
      mermaid: v.mermaid,
      thumbnail: v.thumbnail,
      caption: v.caption,
      howToRead: v.howToRead,
      level: dto.level ?? 'beginner',
      status: 'ready',
      provider: (v.metadata?.['imageProvider'] as string) ?? (v.metadata?.['generator'] as string) ?? 'deterministic',
      metadata: v.metadata,
    });
  }

  async fromFlowNode(userId: string, dto: FromFlowNodeDto): Promise<VisualAssetDocument> {
    const flow = await this.flows.get(userId, dto.flowId);
    const node = flow.nodes.find((n) => n.id === dto.nodeId);
    if (!node) throw new NotFoundException('Node not found');
    const concept = node.title;
    const v = await this.explainer.generate(userId, {
      concept,
      prompt: node.objective || node.summary,
      type: dto.type,
    });
    const asset = await this.model.create({
      user: new Types.ObjectId(userId),
      type: v.type,
      title: concept.slice(0, 160),
      prompt: node.objective || node.summary || concept,
      sourceType: 'flow',
      sourceId: dto.flowId,
      sourceNodeId: dto.nodeId,
      contentFormat: v.contentFormat,
      content: v.content,
      mermaid: v.mermaid,
      thumbnail: v.thumbnail,
      caption: v.caption,
      howToRead: v.howToRead,
      status: 'ready',
      provider: (v.metadata?.['imageProvider'] as string) ?? 'deterministic',
      metadata: v.metadata,
    });
    // Link the visual back onto the flow node (best-effort).
    await this.flows.linkVisual(userId, dto.flowId, dto.nodeId, String(asset._id)).catch(() => undefined);
    return asset;
  }

  list(userId: string): Promise<VisualAssetDocument[]> {
    return this.model.find({ user: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  async get(userId: string, id: string): Promise<VisualAssetDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Visual not found');
    const v = await this.model.findById(id).exec();
    if (!v || v.user.toString() !== userId) throw new NotFoundException('Visual not found');
    return v;
  }

  async update(userId: string, id: string, body: { title?: string; caption?: string }): Promise<VisualAssetDocument> {
    const v = await this.get(userId, id);
    if (body.title !== undefined) v.title = body.title;
    if (body.caption !== undefined) v.caption = body.caption;
    return v.save();
  }

  async regenerate(userId: string, id: string): Promise<VisualAssetDocument> {
    const v = await this.get(userId, id);
    const out = await this.explainer.generate(userId, { concept: v.prompt || v.title, type: v.type, level: v.level });
    v.contentFormat = out.contentFormat;
    v.content = out.content;
    v.mermaid = out.mermaid;
    v.thumbnail = out.thumbnail;
    v.caption = out.caption;
    v.howToRead = out.howToRead;
    v.status = 'ready';
    v.metadata = out.metadata;
    return v.save();
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const v = await this.get(userId, id);
    await v.deleteOne();
    return { ok: true };
  }
}
