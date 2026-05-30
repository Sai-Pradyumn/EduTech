import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
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
import { OrgContext } from './rbac.types';
import { OrganizationsService } from './services/organizations.service';
import { MembershipService } from './services/membership.service';
import { TenantService } from './services/tenant.service';
import { AddMemberDto, CreateOrgDto, UpdateMemberRoleDto, UpdateOrgDto } from './dto/tenancy.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly members: MembershipService,
    private readonly tenant: TenantService,
  ) {}

  /** Any authenticated user can create an org and becomes its ORG_ADMIN. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrgDto) {
    const org = await this.orgs.create(user.id, dto);
    return this.orgs.toView(org);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orgs.listMine(user.id);
  }

  /** Effective tenant context (active org + permissions) for the frontend to gate UI. */
  @Get('context')
  context(@CurrentUser() user: AuthUser, @Headers('x-org-id') orgId?: string): Promise<OrgContext> {
    return this.tenant.resolve(user, orgId);
  }

  @Get(':id')
  @Permissions(Permission.OrgView)
  async get(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    this.assertOrg(ctx, id);
    return this.orgs.toView(await this.orgs.getById(id));
  }

  @Patch(':id')
  @Permissions(Permission.OrgManage)
  async update(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: UpdateOrgDto) {
    this.assertOrg(ctx, id);
    const org = await this.orgs.update(id, {
      name: dto.name,
      description: dto.description,
      type: dto.type,
      branding: { tagline: dto.tagline, primaryColor: dto.primaryColor },
    });
    return this.orgs.toView(org);
  }

  @Get(':id/members')
  @Permissions(Permission.StudentView)
  listMembers(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
    this.assertOrg(ctx, id);
    return this.members.listMembers(id);
  }

  @Post(':id/members')
  @Permissions(Permission.MemberManage)
  addMember(@CurrentUser() user: AuthUser, @CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: AddMemberDto) {
    this.assertOrg(ctx, id);
    return this.members.addMember(id, dto.email, dto.orgRole, user.id);
  }

  @Patch(':id/members/:userId')
  @Permissions(Permission.MemberManage)
  async updateMember(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateMemberRoleDto) {
    this.assertOrg(ctx, id);
    await this.members.updateRole(id, userId, dto.orgRole);
    return { ok: true };
  }

  @Delete(':id/members/:userId')
  @Permissions(Permission.MemberManage)
  async removeMember(@CurrentUser() user: AuthUser, @CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('userId') userId: string) {
    this.assertOrg(ctx, id);
    await this.members.removeMember(id, userId, user.id);
    return { ok: true };
  }

  /** Tenant isolation: a non-platform caller may only act on the org they hold the permission in. */
  private assertOrg(ctx: OrgContext, id: string): void {
    if (!ctx.isPlatform && ctx.organizationId !== id) {
      throw new ForbiddenException('You do not have access to this organization.');
    }
  }
}
