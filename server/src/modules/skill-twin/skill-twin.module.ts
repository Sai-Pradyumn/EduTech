import { Module } from '@nestjs/common';
import { LearningIntelligenceModule } from '../learning-intelligence/learning-intelligence.module';
import { MistakesModule } from '../mistakes/mistakes.module';
import { FlowsModule } from '../flows/flows.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { SkillTwinController } from './skill-twin.controller';
import { SkillTwinService } from './skill-twin.service';

/**
 * Phase 8 · Skill Twin — a live, explainable learner model. Read-only: blends the
 * Learning-Intelligence overview, Mistake OS, the active flow and the profile into
 * readiness/retention/pace, a mastery graph, misconception memory, an adaptive modality
 * recommendation and next-best-actions that each carry a "why". Owns no persistence
 * (except the memory-reset, which clears Mistake OS + flagged weak areas).
 */
@Module({
  imports: [LearningIntelligenceModule, MistakesModule, FlowsModule, StudentProfileModule],
  controllers: [SkillTwinController],
  providers: [SkillTwinService],
  exports: [SkillTwinService],
})
export class SkillTwinModule {}
