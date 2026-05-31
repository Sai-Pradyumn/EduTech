import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkillTwinModule } from '../skill-twin/skill-twin.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ProjectsModule } from '../projects/projects.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import {
  CareerReadinessState,
  CareerReadinessStateSchema,
} from './schemas/career-readiness.schema';
import { CareerReadinessController } from './career-readiness.controller';
import { CareerReadinessService } from './career-readiness.service';
import { CareerReadinessAgent } from './career-readiness.agent';

/**
 * Phase 9 · Career Readiness Engine — maps the learner against a target-role rubric to produce an
 * explainable readiness score, skill/project/interview gaps, top blockers and a 7-day plan. Uses
 * the AI gateway (CareerReadinessAgent) for a human explanation with a deterministic fallback.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CareerReadinessState.name, schema: CareerReadinessStateSchema },
    ]),
    SkillTwinModule,
    LedgerModule,
    ProjectsModule,
    StudentProfileModule,
  ],
  controllers: [CareerReadinessController],
  providers: [CareerReadinessService, CareerReadinessAgent],
  exports: [CareerReadinessService],
})
export class CareerReadinessModule {}
