import { Controller, Get } from '@nestjs/common';
import { Permission } from '../../common/enums';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { OrganizationsService } from './services/organizations.service';

/** Platform-operator surface (super/platform admins only). */
@Controller('platform')
export class PlatformController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get('organizations')
  @Permissions(Permission.PlatformManage)
  listOrganizations() {
    return this.orgs.listAll();
  }

  @Get('stats')
  @Permissions(Permission.PlatformManage)
  async stats() {
    const orgs = await this.orgs.listAll();
    return {
      organizations: orgs.length,
      totalMembers: orgs.reduce((s, o) => s + o.memberCount, 0),
      byType: orgs.reduce<Record<string, number>>((acc, o) => {
        acc[o.type] = (acc[o.type] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }
}
