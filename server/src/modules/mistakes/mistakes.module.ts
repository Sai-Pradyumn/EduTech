import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { FlowsModule } from '../flows/flows.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ProjectsModule } from '../projects/projects.module';
import { Mistake, MistakeSchema } from './schemas/mistake.schema';
import { MistakesController } from './mistakes.controller';
import { MistakesService } from './mistakes.service';
import { MistakesChatCommands } from './mistakes-chat-commands';
import { ReviewTestService } from './review-test.service';

/**
 * Phase 8 · Mistake OS — remembers misconceptions instead of just scores. Auto-captures weak topics
 * from graded quizzes (QuizGradedEvent), turns them into repair loops (micro-quiz / visual / tutor /
 * voice viva), and can inject weak_area_repair nodes into the learner's active flow. Imports
 * FlowsModule for the flow-repair integration.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Mistake.name, schema: MistakeSchema }]),
    FlowsModule,
    LedgerModule,
    ProjectsModule,
    AssessmentModule,
    AgentsModule,
  ],
  controllers: [MistakesController],
  providers: [MistakesService, ReviewTestService, MistakesChatCommands],
  exports: [MistakesService],
})
export class MistakesModule {}
