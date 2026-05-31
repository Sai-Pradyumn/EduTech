import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { MistakesService } from './mistakes.service';
import { MistakeDocument, MistakeStatus } from './schemas/mistake.schema';
import { CaptureMistakeDto, ToggleActionDto, UpdateMistakeStatusDto } from './dto/mistake.dto';

function toView(m: MistakeDocument) {
  return {
    id: String(m._id),
    concept: m.concept,
    topic: m.topic,
    mistakeType: m.mistakeType,
    wrongReasoning: m.wrongReasoning,
    correction: m.correction,
    severity: m.severity,
    frequency: m.frequency,
    source: m.source,
    sourceId: m.sourceId ?? null,
    status: m.status,
    repairActions: m.repairActions.map((a) => ({ id: a.id, kind: a.kind, label: a.label, route: a.route ?? null, prompt: a.prompt ?? null, done: a.done })),
    linkedQuizId: m.linkedQuizId ?? null,
    linkedFlowId: m.linkedFlowId ?? null,
    linkedVisualId: m.linkedVisualId ?? null,
    lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
    resolvedAt: m.resolvedAt?.toISOString() ?? null,
    createdAt: (m as MistakeDocument & { createdAt?: Date }).createdAt?.toISOString() ?? '',
  };
}

@Controller('mistakes')
export class MistakesController {
  constructor(private readonly mistakes: MistakesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('status') status?: MistakeStatus) {
    return (await this.mistakes.list(user.id, status)).map(toView);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.mistakes.stats(user.id);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.mistakes.get(user.id, id));
  }

  @Post('capture')
  async capture(@CurrentUser() user: AuthUser, @Body() dto: CaptureMistakeDto) {
    return toView(await this.mistakes.captureManual(user.id, dto));
  }

  @Post(':id/repair')
  async repair(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.mistakes.generateRepair(user.id, id));
  }

  @Patch(':id/status')
  async status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMistakeStatusDto) {
    return toView(await this.mistakes.updateStatus(user.id, id, dto.status));
  }

  @Patch(':id/actions')
  async toggleAction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ToggleActionDto) {
    return toView(await this.mistakes.toggleAction(user.id, id, dto.actionId, dto.done));
  }

  @Post(':id/repair-flow')
  async repairFlow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { mistake, flowId, nodeId } = await this.mistakes.repairFlow(user.id, id);
    return { mistake: toView(mistake), flowId, nodeId };
  }

  @Post(':id/repair-project')
  async repairProject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { mistake, projectId } = await this.mistakes.repairProject(user.id, id);
    return { mistake: toView(mistake), projectId };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mistakes.remove(user.id, id);
  }
}
