import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OpsService } from './ops.service';

/** Uncaught browser error reported by the client ErrorHandler. Hard length caps so the
 *  public endpoint can't be used to stuff the error collection with megabyte payloads. */
class ClientErrorDto {
  @IsString()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  url?: string;
}

/** Ops Command Center (Phase 10 · M7). Health is public (probes); the rest is Role.Admin. */
@Controller('ops')
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Public()
  @Get('health')
  health() {
    return this.ops.health();
  }

  /** Browser error ingestion — public (errors happen on public pages too), but behind a
   *  tight per-IP rate limit (main.ts) and strict payload caps. Feeds the same persisted
   *  error feed admins already read at GET /ops/errors. */
  @Public()
  @Post('client-errors')
  async clientError(@Body() dto: ClientErrorDto) {
    const errorId = await this.ops.recordError({
      status: 0,
      code: 'CLIENT_ERROR',
      message: dto.message,
      route: dto.url,
      method: 'CLIENT',
      stack: dto.stack,
    });
    return { ok: true, errorId };
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
