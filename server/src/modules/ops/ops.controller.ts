import { Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OpsService } from './ops.service';

/** Ops Command Center (Phase 10 · M7). Health is public (probes); the rest is Role.Admin. */
@Controller('ops')
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Public()
  @Get('health')
  health() {
    return this.ops.health();
  }

  @Roles(Role.Admin)
  @Get('metrics')
  metrics() {
    return this.ops.metrics();
  }

  @Roles(Role.Admin)
  @Get('jobs')
  jobs() {
    return this.ops.jobStats();
  }

  @Roles(Role.Admin)
  @Get('jobs/failed')
  failedJobs() {
    return this.ops.failedJobs();
  }

  @Roles(Role.Admin)
  @Post('jobs/:id/retry')
  retry(@Param('id') id: string) {
    return this.ops.retryJob(id);
  }

  @Roles(Role.Admin)
  @Get('errors')
  errors() {
    return this.ops.listErrors();
  }

  @Roles(Role.Admin)
  @Get('realtime')
  realtime() {
    return this.ops.realtime();
  }

  @Roles(Role.Admin)
  @Get('storage')
  storage() {
    return this.ops.storage();
  }
}
