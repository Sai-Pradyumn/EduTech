import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { Project, ProjectSchema } from './schemas/project.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectBlueprintGenerator } from './services/project-blueprint.generator';
import { ProjectReviewGenerator } from './services/project-review.generator';

/**
 * Project Studio: deterministic blueprint generation (tech stack, features, phased Kanban
 * tasks, milestones), Kanban progress, and a submission scaffold (links + notes) that the
 * Phase-4 AI/mentor review will consume. Exports ProjectsService for the ProjectBuilder
 * agent and the Learning-Intelligence engine.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
    StudentProfileModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectBlueprintGenerator, ProjectReviewGenerator],
  exports: [ProjectsService],
})
export class ProjectsModule {}
