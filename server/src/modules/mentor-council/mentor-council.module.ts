import { Module } from '@nestjs/common';
import { LearningIntelligenceModule } from '../learning-intelligence/learning-intelligence.module';
import { FlowsModule } from '../flows/flows.module';
import { MistakesModule } from '../mistakes/mistakes.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { MentorCouncilController } from './mentor-council.controller';
import { MentorCouncilService } from './mentor-council.service';

/**
 * Phase 8 · AI Mentor Council — five agent perspectives debate the learner's next best move; a chair
 * scores urgency and picks one with an explainable synthesis. Read-only; reuses LI + Flows + Mistakes.
 */
@Module({
  imports: [
    LearningIntelligenceModule,
    FlowsModule,
    MistakesModule,
    StudentProfileModule,
  ],
  controllers: [MentorCouncilController],
  providers: [MentorCouncilService],
  exports: [MentorCouncilService],
})
export class MentorCouncilModule {}
