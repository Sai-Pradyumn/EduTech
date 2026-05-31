import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorLog, ErrorLogSchema } from './schemas/error-log.schema';
import { JobRun, JobRunSchema } from './schemas/job-run.schema';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

/**
 * Ops Command Center (Phase 10 · M7). Global so the exception filter + any producer can
 * record errors/jobs. Exposes /ops/* health, metrics, jobs and the persisted error feed.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ErrorLog.name, schema: ErrorLogSchema },
      { name: JobRun.name, schema: JobRunSchema },
    ]),
  ],
  controllers: [OpsController],
  providers: [OpsService],
  exports: [OpsService],
})
export class OpsModule {}
