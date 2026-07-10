import { Controller, Get } from '@nestjs/common';
import { Permission } from '../../common/enums';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireMfa } from '../../common/decorators/require-mfa.decorator';
import { FounderService } from './founder.service';

/**
 * Founder / operator dashboard surface (Phase 4 · B17). PlatformManage only — these are
 * cross-organization platform aggregates, not org-scoped.
 * @RequireMfa enforces mandatory MFA once REQUIRE_ADMIN_MFA=true (AU-03).
 */
@Controller('founder')
@RequireMfa()
export class FounderController {
  constructor(private readonly founder: FounderService) {}

  @Get('overview')
  @Permissions(Permission.PlatformManage)
  overview() {
    return this.founder.overview();
  }
}
