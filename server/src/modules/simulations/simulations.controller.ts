import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { SimulationsService } from './simulations.service';
import { SimulationDocument } from './schemas/simulation.schema';
import { RespondDto, RetryDto, StartSimulationDto } from './dto/simulation.dto';

function toView(s: SimulationDocument) {
  return {
    id: String(s._id),
    type: s.type,
    topic: s.topic,
    difficulty: s.difficulty,
    role: s.role,
    scenario: s.scenario,
    rubric: s.rubric.map((c) => ({ criterion: c.criterion, weight: c.weight, score: c.score })),
    transcript: s.transcript.map((t) => ({ role: t.role, text: t.text, at: t.at?.toISOString() ?? '' })),
    score: s.score,
    feedback: s.feedback,
    improvementPlan: s.improvementPlan,
    linkedSkills: s.linkedSkills,
    linkedMistakeIds: s.linkedMistakeIds,
    linkedFlowId: s.linkedFlowId ?? null,
    status: s.status,
    createdAt: (s as SimulationDocument & { createdAt?: Date }).createdAt?.toISOString() ?? '',
  };
}

@Controller('simulations')
export class SimulationsController {
  constructor(
    private readonly sims: SimulationsService,
    private readonly config: ConfigService,
  ) {}

  private assertEnabled(): void {
    if (this.config.get<{ simulations?: boolean }>('flags')?.simulations === false) {
      throw new ForbiddenException('Simulation Labs is disabled on this deployment.');
    }
  }

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async start(@CurrentUser() user: AuthUser, @Body() dto: StartSimulationDto) {
    this.assertEnabled();
    return toView(await this.sims.start(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.sims.list(user.id)).map(toView);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.sims.get(user.id, id));
  }

  @Post(':id/respond')
  async respond(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RespondDto) {
    return toView(await this.sims.respond(user.id, user.role, id, dto.message));
  }

  @Post(':id/finish')
  async finish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.sims.finish(user.id, id));
  }

  @Post(':id/retry')
  async retry(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RetryDto) {
    return toView(await this.sims.retry(user.id, id, dto.harder));
  }

  @Post(':id/create-repair-flow')
  async repairFlow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { simulation, flowId, nodeId } = await this.sims.createRepairFlow(user.id, id);
    return { simulation: toView(simulation), flowId, nodeId };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sims.remove(user.id, id);
  }
}
