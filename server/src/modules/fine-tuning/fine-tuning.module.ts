import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FineTuningJob, FineTuningJobSchema } from './schemas/fine-tuning-job.schema';
import { FineTuningController } from './fine-tuning.controller';
import { FineTuningService } from './fine-tuning.service';

/**
 * Fine-Tuning Lab (Phase 3 · A8): LoRA job records orchestrating the ml-service. Progress is
 * simulated from elapsed time (ml-service not wired). Gated by ENABLE_FINE_TUNING.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: FineTuningJob.name, schema: FineTuningJobSchema }])],
  controllers: [FineTuningController],
  providers: [FineTuningService],
  exports: [FineTuningService],
})
export class FineTuningModule {}
