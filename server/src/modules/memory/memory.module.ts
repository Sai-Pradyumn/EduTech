import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import {
  LearnerMemory,
  LearnerMemorySchema,
} from './schemas/learner-memory.schema';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MemoryChatCommands } from './memory-chat-commands';

/**
 * Phase E · Memory updates. Stores learner-approved facts Asta remembers, with an
 * audit trail (AuditService is @Global). Detection happens client-side in Asta OS;
 * nothing is persisted until the learner confirms — plus the memory manager
 * (list/delete across both stores) and "remember/forget …" chat commands.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearnerMemory.name, schema: LearnerMemorySchema },
    ]),
    AgentsModule,
  ],
  controllers: [MemoryController],
  providers: [MemoryService, MemoryChatCommands],
  exports: [MemoryService],
})
export class MemoryModule {}
