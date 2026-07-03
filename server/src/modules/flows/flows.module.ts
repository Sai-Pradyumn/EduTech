import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { LedgerModule } from '../ledger/ledger.module';
import { Flow, FlowSchema } from './schemas/flow.schema';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowsChatCommands } from './flows-chat-commands';
import { FlowArchitectService } from './flow-architect/flow-architect.service';

/**
 * Phase 8 · Flow Studio — living, visual learning graphs. The FlowArchitect converts a goal
 * (+ profile, weak areas, optional roadmap) into a dependency graph of concept/practice/quiz/
 * project/voice/mastery nodes. Works offline via a deterministic blueprint; honors the LLM
 * gateway when a key is configured. Reads the Roadmap model directly for from-roadmap.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Flow.name, schema: FlowSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
    ]),
    StudentProfileModule,
    LedgerModule,
    AgentsModule,
  ],
  controllers: [FlowsController],
  providers: [FlowsService, FlowArchitectService, FlowsChatCommands],
  exports: [FlowsService],
})
export class FlowsModule {}
