import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Permission, Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { AuthUser } from '../../common/interfaces';
import { OrgContext } from '../tenancy/rbac.types';
import { DataGovernanceService } from './data-governance.service';

class DeleteRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Data export, deletion requests & retention (Phase 10 · M14). */
@Controller()
export class DataGovernanceController {
  constructor(private readonly data: DataGovernanceService) {}

  @Post('data/export/me')
  exportMe(@CurrentUser() user: AuthUser) {
    return this.data.requestExport('user', user.id);
  }

  @Get('data/export/jobs')
  jobs(@CurrentUser() user: AuthUser) {
    return this.data.listJobs('user', user.id);
  }

  @Post('data/delete-request')
  deleteRequest(@CurrentUser() user: AuthUser, @Body() dto: DeleteRequestDto) {
    return this.data.requestDeletion('user', user.id, dto.note);
  }

  @Permissions(Permission.OrgManage)
  @Post('org/data/export')
  exportOrg(@CurrentOrg() org: OrgContext) {
    return this.data.requestExport('org', org.organizationId ?? '');
  }

  @Roles(Role.Admin)
  @Get('admin/data-governance/retention')
  retention() {
    return this.data.retention();
  }
}
