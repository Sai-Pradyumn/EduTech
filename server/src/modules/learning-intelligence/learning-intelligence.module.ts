import { Module } from '@nestjs/common';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ProjectsModule } from '../projects/projects.module';
import { AgentsModule } from '../agents/agents.module';
import { LearningIntelligenceController } from './learning-intelligence.controller';
import { LearningIntelligenceService } from './learning-intelligence.service';

/**
 * Read-only analytics layer. Reuses the profile / roadmap / assessment / agent-session
 * services to compute the cockpit overview without owning any persistence of its own.
 */
@Module({
  imports: [
    StudentProfileModule,
    RoadmapModule,
    AssessmentModule,
    ProjectsModule,
    AgentsModule,
  ],
  controllers: [LearningIntelligenceController],
  providers: [LearningIntelligenceService],
  exports: [LearningIntelligenceService],
})
export class LearningIntelligenceModule {}
