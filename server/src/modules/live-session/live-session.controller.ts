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
import { LiveSessionService } from './services/live-session.service';
import { CreateLiveSessionDto, EndSessionDto, UpdateLiveSessionDto } from './dto/live-session.dto';

/**
 * Live session surface (Phase 4 · B4). Hosting/management requires CohortCreate
 * (mentors / instructors / admins); listing requires CohortView; `/mine` and join are
 * open to any authenticated student. Tenant-isolated via `assertOrg`.
 */
@Controller('live-sessions')
export class LiveSessionController {
  constructor(
    private readonly sessions: LiveSessionService,
    private readonly users: UsersService,
  ) {}

  /** Upcoming + past sessions for the signed-in student's cohorts. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.sessions.listForStudent(user.id);
  }

  @Get()
  @Permissions(Permission.CohortView)
  list(@CurrentOrg() ctx: OrgContext) {
    if (!ctx.organizationId) throw new BadRequestException('Select an organization (x-org-id) first.');
    return this.sessions.listForOrg(ctx.organizationId);
  }

  @Post()
  @Permissions(Permission.CohortCreate)
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @CurrentOrg() ctx: OrgContext, @Body() dto: CreateLiveSessionDto) {
    if (!ctx.organizationId) throw new BadRequestException('Select an organization (x-org-id) first.');
    const host = await this.users.findByIdOrThrow(user.id);
    return this.sessions.create(ctx.organizationId, user.id, host.name, dto);
  }

  @Get(':id')
  @Permissions(Permission.CohortView)
  async detail(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    await this.assertOrg(ctx, id);
    return this.sessions.getDetail(id);
  }

  @Post(':id/start')
  @Permissions(Permission.CohortCreate)
  async start(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    await this.assertOrg(ctx, id);
    return this.sessions.start(id);
  }

  @Post(':id/end')
  @Permissions(Permission.CohortCreate)
  async end(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: EndSessionDto) {
    await this.assertOrg(ctx, id);
    return this.sessions.end(id, dto.notes ?? '');
  }

  /** A student marks attendance / joins the room. */
  @Post(':id/join')
  async join(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const u = await this.users.findByIdOrThrow(user.id);
    return this.sessions.join(id, user.id, u.name);
  }

  @Patch(':id')
  @Permissions(Permission.CohortCreate)
  async update(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: UpdateLiveSessionDto) {
    await this.assertOrg(ctx, id);
    return this.sessions.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.CohortCreate)
  async remove(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    await this.assertOrg(ctx, id);
    return this.sessions.remove(id);
  }

  /** Tenant isolation: non-platform callers may only touch sessions in their active org. */
  private async assertOrg(ctx: OrgContext, sessionId: string): Promise<void> {
    if (ctx.isPlatform) return;
    const orgId = await this.sessions.orgIdOf(sessionId);
    if (ctx.organizationId !== orgId) throw new ForbiddenException('You do not have access to this session.');
  }
}
