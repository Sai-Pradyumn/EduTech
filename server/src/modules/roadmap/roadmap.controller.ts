import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { RoadmapService, RoadmapVersionSummary } from './roadmap.service';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';
import { RegenerateWeekDto, ReplanDto } from './dto/regenerate-week.dto';
import { UpdateRoadmapProgressDto } from './dto/update-roadmap-progress.dto';
import { UpdateRoadmapStatusDto } from './dto/update-roadmap-status.dto';
import {
  RoadmapResponse,
  RoadmapSummary,
  toRoadmapResponse,
  toRoadmapSummary,
} from './dto/roadmap-response.dto';

@Controller('roadmaps')
export class RoadmapController {
  constructor(private readonly roadmaps: RoadmapService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateRoadmapDto,
  ): Promise<RoadmapResponse> {
    const roadmap = await this.roadmaps.generate(user.id, dto);
    return toRoadmapResponse(roadmap);
  }

  @Get('my')
  async my(@CurrentUser() user: AuthUser): Promise<RoadmapSummary[]> {
    const list = await this.roadmaps.findMine(user.id);
    return list.map(toRoadmapSummary);
  }

  @Get('active')
  async active(@CurrentUser() user: AuthUser): Promise<RoadmapResponse | null> {
    const roadmap = await this.roadmaps.findActive(user.id);
    return roadmap ? toRoadmapResponse(roadmap) : null;
  }

  @Get(':id')
  async byId(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<RoadmapResponse> {
    return toRoadmapResponse(await this.roadmaps.findByIdForUser(user.id, id));
  }

  @Patch(':id/progress')
  async progress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoadmapProgressDto,
  ): Promise<RoadmapResponse> {
    return toRoadmapResponse(
      await this.roadmaps.updateProgress(user.id, id, dto),
    );
  }

  @Post(':id/regenerate-week')
  async regenerateWeek(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RegenerateWeekDto,
  ): Promise<RoadmapResponse> {
    return toRoadmapResponse(
      await this.roadmaps.regenerateWeek(user.id, id, dto.weekNumber, dto.note),
    );
  }

  /** Adaptive re-plan: regenerate the next uncompleted weeks to fit real pace. */
  @Post(':id/replan')
  async replan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplanDto,
  ): Promise<RoadmapResponse> {
    return toRoadmapResponse(
      await this.roadmaps.replanRemaining(user.id, id, dto.note),
    );
  }

  /** Git-style content history: every generation/edit/restore is a version. */
  @Get(':id/versions')
  versions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<RoadmapVersionSummary[]> {
    return this.roadmaps.listVersions(user.id, id);
  }

  /** Restore the roadmap content to any earlier version (progress survives). */
  @Post(':id/versions/:version/restore')
  async restore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('version') version: string,
  ): Promise<RoadmapResponse> {
    return toRoadmapResponse(
      await this.roadmaps.restoreVersion(user.id, id, Number(version)),
    );
  }

  @Patch(':id/status')
  async status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoadmapStatusDto,
  ): Promise<RoadmapResponse> {
    return toRoadmapResponse(
      await this.roadmaps.updateStatus(user.id, id, dto),
    );
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    return this.roadmaps.remove(user.id, id);
  }
}
