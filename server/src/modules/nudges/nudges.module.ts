import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { SkillPassportModule } from '../skill-passport/skill-passport.module';
import { CareerReadinessModule } from '../career-readiness/career-readiness.module';
import { MistakesModule } from '../mistakes/mistakes.module';
import {
  DailyPlan,
  DailyPlanSchema,
} from '../daily-plan/schemas/daily-plan.schema';
import {
  LiveSession,
  LiveSessionSchema,
} from '../live-session/schemas/live-session.schema';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EngagementSchedulerService } from './engagement-scheduler.service';
import { NudgeEngine } from './nudge-engine.service';
import { NudgeService } from './nudge.service';
import { NudgesController } from './nudges.controller';

/**
 * Phase 9 · Nudge intelligence — event-driven nudges (NudgeEngine → de-duplicated notifications),
 * a pull-based GET /nudges computing the learner's current best actions from live state, and
 * the time-based EngagementScheduler (inactivity + due-review nudges, Monday digest via
 * in-app + config-gated email).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DailyPlan.name, schema: DailyPlanSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
      { name: LiveSession.name, schema: LiveSessionSchema },
    ]),
    NotificationsModule,
    SkillPassportModule,
    CareerReadinessModule,
    MistakesModule,
  ],
  controllers: [NudgesController],
  providers: [NudgeEngine, NudgeService, EngagementSchedulerService],
})
export class NudgesModule {}
