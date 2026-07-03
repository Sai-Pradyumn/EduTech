import {
  BadRequestException,
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
import { Permission } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/interfaces';
import { OrgContext } from '../tenancy/rbac.types';
import { UsersService } from '../users/users.service';
import { CohortService } from './services/cohort.service';
import {
  AddCohortMembersDto,
  AnnouncementDto,
  CreateCohortDto,
  LeaderboardOptInDto,
  UpdateCohortDto,
} from './dto/cohort.dto';

/**
 * Cohort surface (Phase 4 · B3). Manage routes require CohortCreate (org admins);
 * view routes require CohortView (members incl. students). `/mine` is the student's
 * own cohort list. Tenant-isolated via `assertOrg` against the cohort's organization.
 */
@Controller('cohorts')
export class CohortController {
  constructor(
    private readonly cohorts: CohortService,
    private readonly users: UsersService,
  ) {}

  /** Cohorts the signed-in user belongs to as a student. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.cohorts.listForStudent(user.id);
  }

  /** All cohorts in the active organization (admins / mentors). */
  @Get()
  @Permissions(Permission.CohortView)
  list(@CurrentOrg() ctx: OrgContext) {
    if (!ctx.organizationId)
      throw new BadRequestException('Select an organization (x-org-id) first.');
    return this.cohorts.listForOrg(ctx.organizationId);
  }

  @Post()
  @Permissions(Permission.CohortCreate)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Body() dto: CreateCohortDto,
  ) {
    if (!ctx.organizationId)
      throw new BadRequestException('Select an organization (x-org-id) first.');
    return this.cohorts.create(ctx.organizationId, user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.CohortView)
  async detail(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    await this.assertOrg(ctx, id);
    return this.cohorts.getDetail(id);
  }

  @Get(':id/leaderboard')
  @Permissions(Permission.CohortView)
  async leaderboard(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    await this.assertOrg(ctx, id);
    return this.cohorts.leaderboard(id);
  }

  /** Peer leaderboard — opt-in both ways: only listed members can look. */
  @Get(':id/leaderboard/peers')
  @Permissions(Permission.CohortView)
  async peerLeaderboard(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
  ) {
    await this.assertOrg(ctx, id);
    return this.cohorts.peerLeaderboard(id, user.id);
  }

  /** Join/leave the peer leaderboards (a user-level privacy choice). */
  @Post('leaderboard/opt-in')
  async leaderboardOptIn(
    @CurrentUser() user: AuthUser,
    @Body() dto: LeaderboardOptInDto,
  ) {
    await this.users.setLeaderboardOptIn(user.id, dto.optIn);
    return { ok: true, optIn: dto.optIn };
  }

  @Patch(':id')
  @Permissions(Permission.CohortCreate)
  async update(
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateCohortDto,
  ) {
    await this.assertOrg(ctx, id);
    return this.cohorts.update(id, dto);
  }

  @Post(':id/members')
  @Permissions(Permission.CohortCreate)
  async addMembers(
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
    @Body() dto: AddCohortMembersDto,
  ) {
    await this.assertOrg(ctx, id);
    return this.cohorts.addMembers(id, dto.userIds, dto.role);
  }

  @Delete(':id/members/:userId')
  @Permissions(Permission.CohortCreate)
  async removeMember(
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.assertOrg(ctx, id);
    return this.cohorts.removeMember(id, userId);
  }

  @Post(':id/announcements')
  @Permissions(Permission.CohortCreate)
  async announce(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
    @Body() dto: AnnouncementDto,
  ) {
    await this.assertOrg(ctx, id);
    const author = await this.users.findByIdOrThrow(user.id);
    return this.cohorts.postAnnouncement(
      id,
      author.name,
      dto.title,
      dto.body ?? '',
    );
  }

  @Delete(':id')
  @Permissions(Permission.CohortCreate)
  async remove(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    await this.assertOrg(ctx, id);
    return this.cohorts.remove(id);
  }

  /** Tenant isolation: non-platform callers may only touch cohorts in their active org. */
  private async assertOrg(ctx: OrgContext, cohortId: string): Promise<void> {
    if (ctx.isPlatform) return;
    const orgId = await this.cohorts.orgIdOf(cohortId);
    if (ctx.organizationId !== orgId)
      throw new ForbiddenException('You do not have access to this cohort.');
  }
}
