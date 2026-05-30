import { Controller, Get } from '@nestjs/common';
import { Permission } from '../../common/enums';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { FounderService } from './founder.service';

/**
 * Founder / operator dashboard surface (Phase 4 · B17). PlatformManage only — these are
 * cross-organization platform aggregates, not org-scoped.
 */
@Controller('founder')
export class FounderController {
  constructor(private readonly founder: FounderService) {}

  @Get('overview')
  @Permissions(Permission.PlatformManage)
  overview() {
    return this.founder.overview();
  }
}
