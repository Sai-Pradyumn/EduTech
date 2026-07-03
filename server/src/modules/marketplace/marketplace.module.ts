import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { FlowsModule } from '../flows/flows.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ProjectsModule } from '../projects/projects.module';
import { VisualsModule } from '../visuals/visuals.module';
import { CourseBuilderModule } from '../course-builder/course-builder.module';
import {
  MarketplaceTemplate,
  MarketplaceTemplateSchema,
} from './schemas/marketplace-template.schema';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { TemplateClonerService } from './template-cloner.service';

/**
 * Phase 9 · Creator/Template Marketplace — mentors/creators publish reusable learning assets
 * (flow/roadmap/quiz/project/… templates); admins moderate; learners browse and clone into their
 * own assets. "Use template" clones through each asset's own generation pipeline.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketplaceTemplate.name, schema: MarketplaceTemplateSchema },
    ]),
    UsersModule,
    FlowsModule,
    RoadmapModule,
    AssessmentModule,
    ProjectsModule,
    VisualsModule,
    CourseBuilderModule,
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, TemplateClonerService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
