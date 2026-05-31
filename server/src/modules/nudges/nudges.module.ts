import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SkillPassportModule } from '../skill-passport/skill-passport.module';
import { CareerReadinessModule } from '../career-readiness/career-readiness.module';
import { NudgeEngine } from './nudge-engine.service';
import { NudgeService } from './nudge.service';
import { NudgesController } from './nudges.controller';

/**
 * Phase 9 · Nudge intelligence — event-driven nudges (NudgeEngine → de-duplicated notifications)
 * plus a pull-based GET /nudges that computes the learner's current best actions from live state.
 */
@Module({
  imports: [NotificationsModule, SkillPassportModule, CareerReadinessModule],
  controllers: [NudgesController],
  providers: [NudgeEngine, NudgeService],
})
export class NudgesModule {}
