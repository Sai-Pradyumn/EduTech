import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerModule } from '../ledger/ledger.module';
import { MistakesModule } from '../mistakes/mistakes.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { InterviewSession, InterviewSessionSchema } from './schemas/interview-session.schema';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { InterviewCoachAgent } from './interview.agent';

/**
 * Phase 9 · Interview OS — role-based mock interviews with scored answers and a feedback report,
 * wired into the outcome graph (ledger → Career Readiness; weak areas → Mistake OS).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: InterviewSession.name, schema: InterviewSessionSchema }]),
    LedgerModule,
    MistakesModule,
    StudentProfileModule,
  ],
  controllers: [InterviewController],
  providers: [InterviewService, InterviewCoachAgent],
  exports: [InterviewService],
})
export class InterviewModule {}
