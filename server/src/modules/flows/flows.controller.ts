import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { FlowsService } from './flows.service';
import { FlowDocument } from './schemas/flow.schema';
import {
  AddNodeDto,
  GenerateFlowDto,
  UpdateFlowDto,
  UpdateNodeDto,
} from './dto/flow.dto';

/** Maps a flow document to the client view (id, not _id). */
function toView(f: FlowDocument) {
  return {
    id: String(f._id),
    title: f.title,
    goal: f.goal,
    description: f.description,
    sourceType: f.sourceType,
    sourceId: f.sourceId ?? null,
    status: f.status,
    difficulty: f.difficulty,
    progressPercentage: f.progressPercentage,
    nodes: f.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      summary: n.summary,
      objective: n.objective,
      difficulty: n.difficulty,
      estimatedMinutes: n.estimatedMinutes,
      masteryScore: n.masteryScore,
      status: n.status,
      position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
      stage: n.stage,
      prerequisites: n.prerequisites,
      resources: n.resources,
      agentHints: n.agentHints,
      linkedRoadmapId: n.linkedRoadmapId ?? null,
      linkedQuizId: n.linkedQuizId ?? null,
      linkedProjectId: n.linkedProjectId ?? null,
      linkedKnowledgeDocumentIds: n.linkedKnowledgeDocumentIds ?? [],
      linkedVisualAssetIds: n.linkedVisualAssetIds ?? [],
      linkedVoiceSessionIds: n.linkedVoiceSessionIds ?? [],
    })),
    edges: f.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation,
      strength: e.strength,
      explanation: e.explanation,
    })),
    timeline: f.timeline.map((b) => ({
      index: b.index,
      label: b.label,
      focus: b.focus,
      nodeIds: b.nodeIds,
    })),
    metadata: f.metadata ?? {},
    createdAt:
      (f as FlowDocument & { createdAt?: Date }).createdAt?.toISOString() ?? '',
    updatedAt:
      (f as FlowDocument & { updatedAt?: Date }).updatedAt?.toISOString() ?? '',
  };
}

@Controller('flows')
export class FlowsController {
  constructor(
    private readonly flows: FlowsService,
    private readonly config: ConfigService,
  ) {}

  private isEnabled(): boolean {
    const flags = this.config.get<{ flowStudio?: boolean }>('flags');
    return flags?.flowStudio !== false;
  }

  private assertEnabled(): void {
    if (!this.isEnabled())
      throw new ForbiddenException(
        'Flow Studio is disabled on this deployment.',
      );
  }

  @Get('status')
  status() {
    return { enabled: this.isEnabled() };
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateFlowDto) {
    this.assertEnabled();
    return toView(await this.flows.generate(user.id, dto));
  }

  @Post('from-roadmap/:roadmapId')
  @HttpCode(HttpStatus.CREATED)
  async fromRoadmap(
    @CurrentUser() user: AuthUser,
    @Param('roadmapId') roadmapId: string,
  ) {
    this.assertEnabled();
    return toView(await this.flows.fromRoadmap(user.id, roadmapId));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.flows.list(user.id)).map(toView);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.flows.get(user.id, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFlowDto,
  ) {
    return toView(await this.flows.update(user.id, id, dto));
  }

  @Post(':id/nodes')
  async addNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddNodeDto,
  ) {
    return toView(await this.flows.addNode(user.id, id, dto));
  }

  @Patch(':id/nodes/:nodeId')
  async updateNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateNodeDto,
  ) {
    return toView(await this.flows.updateNode(user.id, id, nodeId, dto));
  }

  @Delete(':id/nodes/:nodeId')
  async removeNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
  ) {
    return toView(await this.flows.removeNode(user.id, id, nodeId));
  }

  @Post(':id/execute-node/:nodeId')
  async executeNode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
  ) {
    const { flow, execution } = await this.flows.executeNode(
      user.id,
      id,
      nodeId,
    );
    return { flow: toView(flow), execution };
  }

  @Post(':id/recalculate')
  async recalculate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.flows.recalculate(user.id, id));
  }

  @Post(':id/export')
  export(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.flows.export(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.flows.remove(user.id, id);
  }
}
