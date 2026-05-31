import { Controller, Get } from '@nestjs/common';
import { Permission, Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { OrgContext } from '../tenancy/rbac.types';
import { AuditService } from './audit.service';

/** Audit log viewers (Phase 10 · M6). Platform feed for admins; org-scoped feed for owners. */
@Controller()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles(Role.Admin)
  @Get('admin/audit-logs')
  adminLogs() {
    return this.audit.list({ limit: 200 });
  }

  @Permissions(Permission.OrgManage)
  @Get('org/audit-logs')
  orgLogs(@CurrentOrg() org: OrgContext) {
    return this.audit.list({
      orgId: org.organizationId ?? undefined,
      limit: 200,
    });
  }
}
