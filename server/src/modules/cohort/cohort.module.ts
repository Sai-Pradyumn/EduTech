import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { LearningIntelligenceModule } from '../learning-intelligence/learning-intelligence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Cohort, CohortSchema } from './schemas/cohort.schema';
import { CohortController } from './cohort.controller';
import { CohortService } from './services/cohort.service';

/**
 * Cohort-based learning (Phase 4 · B3): org-scoped cohorts of students + mentors toward a
 * shared roadmap goal, with announcements and an LI-powered leaderboard. Leaf consumer —
 * reuses tenancy (membership/permissions) and the Learning-Intelligence engine.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cohort.name, schema: CohortSchema }]),
    UsersModule,
    TenancyModule,
    LearningIntelligenceModule,
    NotificationsModule,
  ],
  controllers: [CohortController],
  providers: [CohortService],
  exports: [CohortService],
})
export class CohortModule {}
