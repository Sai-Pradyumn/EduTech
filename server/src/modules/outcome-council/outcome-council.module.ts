import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkillTwinModule } from '../skill-twin/skill-twin.module';
import { CareerReadinessModule } from '../career-readiness/career-readiness.module';
import { CouncilRecommendation, CouncilRecommendationSchema } from './schemas/council-recommendation.schema';
import { OutcomeCouncilController } from './outcome-council.controller';
import { OutcomeCouncilService } from './outcome-council.service';
import { OutcomeCouncilAgent } from './outcome-council.agent';

/**
 * Phase 9 · AI Outcome Council — multiple specialist perspectives debate the learner's single best
 * next real-world action, ranked by impact and narrated into an explainable verdict that links to a
 * concrete in-app action.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: CouncilRecommendation.name, schema: CouncilRecommendationSchema }]),
    SkillTwinModule,
    CareerReadinessModule,
  ],
  controllers: [OutcomeCouncilController],
  providers: [OutcomeCouncilService, OutcomeCouncilAgent],
  exports: [OutcomeCouncilService],
})
export class OutcomeCouncilModule {}
