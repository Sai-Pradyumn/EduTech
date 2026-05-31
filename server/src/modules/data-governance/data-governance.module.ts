import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DataJob, DataJobSchema } from './schemas/data-job.schema';
import { DataGovernanceController } from './data-governance.controller';
import { DataGovernanceService } from './data-governance.service';

/** Data export / deletion / retention (Phase 10 · M14). */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: DataJob.name, schema: DataJobSchema }]),
  ],
  controllers: [DataGovernanceController],
  providers: [DataGovernanceService],
  exports: [DataGovernanceService],
})
export class DataGovernanceModule {}
