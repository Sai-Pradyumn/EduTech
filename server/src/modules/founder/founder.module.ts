import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Organization, OrganizationSchema } from '../tenancy/schemas/organization.schema';
import { Subscription, SubscriptionSchema } from '../billing/schemas/subscription.schema';
import { Cohort, CohortSchema } from '../cohort/schemas/cohort.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Quiz, QuizSchema } from '../assessment/schemas/quiz.schema';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { FounderController } from './founder.controller';
import { FounderService } from './founder.service';

/**
 * Founder / operator dashboard (Phase 4 · B17): platform-wide aggregates. Registers the
 * collections it counts (read-only) + reuses the AI usage facade. PlatformManage-gated.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Cohort.name, schema: CohortSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
    ]),
    AiModule,
  ],
  controllers: [FounderController],
  providers: [FounderService],
})
export class FounderModule {}
