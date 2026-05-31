import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlowsModule } from '../flows/flows.module';
import { MistakesModule } from '../mistakes/mistakes.module';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { DailyPlan, DailyPlanSchema } from './schemas/daily-plan.schema';
import { DailyPlanController } from './daily-plan.controller';
import { DailyPlanService } from './daily-plan.service';

/**
 * Phase 8 · Daily Autopilot — turns the active flow + open mistakes + roadmap into a daily plan.
 * Energy-aware modes: normal · quick ("I only have 20 minutes") · exam ("exam tomorrow") ·
 * burnout_recovery. Reads the Roadmap model directly; reuses Flows + Mistake OS.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyPlan.name, schema: DailyPlanSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
    ]),
    FlowsModule,
    MistakesModule,
  ],
  controllers: [DailyPlanController],
  providers: [DailyPlanService],
  exports: [DailyPlanService],
})
export class DailyPlanModule {}
