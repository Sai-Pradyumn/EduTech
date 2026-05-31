import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiOpsService } from './ai-ops.service';

/** AI Ops dashboards (Phase 10 · M2). Role.Admin. Cost/latency/error observability over
 *  the enriched ai_usage_logs + provider health + budget governance. */
@Roles(Role.Admin)
@Controller('admin/ai-ops')
export class AiOpsController {
  constructor(private readonly aiOps: AiOpsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.aiOps.overview(this.days(days));
  }

  @Get('costs')
  async costs(@Query('days') days?: string) {
    const d = this.days(days);
    const [byDay, byFeature, top] = await Promise.all([
      this.aiOps.costByDay(d),
      this.aiOps.costByFeature(d),
      this.aiOps.topUsers(d),
    ]);
    return { byDay, byFeature, topUsers: top };
  }

  @Get('usage')
  usage(@Query('days') days?: string) {
    return this.aiOps.costByFeature(this.days(days));
  }

  @Get('providers')
  providers() {
    return this.aiOps.providers();
  }

  @Get('budget/:ownerType/:ownerId')
  getBudget(
    @Param('ownerType') ownerType: 'user' | 'org' | 'plan',
    @Param('ownerId') ownerId: string,
  ) {
    return this.aiOps.getBudget(ownerType, ownerId);
  }

  @Patch('budget/:ownerType/:ownerId')
  setBudget(
    @Param('ownerType') ownerType: 'user' | 'org' | 'plan',
    @Param('ownerId') ownerId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.aiOps.setBudget(ownerType, ownerId, patch);
  }

  private days(raw?: string): number {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 365 ? n : 30;
  }
}
