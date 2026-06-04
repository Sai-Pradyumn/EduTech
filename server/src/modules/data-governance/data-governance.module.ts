import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrivacyModule } from '../privacy/privacy.module';
import { fileStorageFactory } from '../rag/storage/file-storage';
import { DataJob, DataJobSchema } from './schemas/data-job.schema';
import { DataGovernanceController } from './data-governance.controller';
import { DataGovernanceService } from './data-governance.service';

/** Data export / deletion / retention (Phase 10 · M14). */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: DataJob.name, schema: DataJobSchema }]),
    PrivacyModule,
  ],
  controllers: [DataGovernanceController],
  providers: [DataGovernanceService, fileStorageFactory],
  exports: [DataGovernanceService],
})
export class DataGovernanceModule {}
