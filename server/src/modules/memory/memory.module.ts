import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LearnerMemory,
  LearnerMemorySchema,
} from './schemas/learner-memory.schema';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

/**
 * Phase E · Memory updates. Stores learner-approved facts Asta remembers, with an
 * audit trail (AuditService is @Global). Detection happens client-side in Asta OS;
 * nothing is persisted until the learner confirms.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearnerMemory.name, schema: LearnerMemorySchema },
    ]),
  ],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
