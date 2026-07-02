import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlowsModule } from '../flows/flows.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { VisualsModule } from '../visuals/visuals.module';
import { ProjectsModule } from '../projects/projects.module';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { Course, CourseSchema } from './schemas/course.schema';
import { CourseArchitectAgent } from './course-architect.agent';
import { LessonComposerService } from './lesson-composer.service';
import { CourseBuilderController } from './course-builder.controller';
import { CourseBuilderService } from './course-builder.service';

/**
 * Phase 8 · Course Builder — mentors/admins turn a goal/outline/roadmap into a full course (modules +
 * lessons + per-module quiz/visual/voice-script + a capstone project + a flow + certificate criteria).
 * Reuses Flows + Assessment + Visuals + Projects. Publishable to org/cohort (role-gated).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
    ]),
    FlowsModule,
    AssessmentModule,
    VisualsModule,
    ProjectsModule,
  ],
  controllers: [CourseBuilderController],
  providers: [
    CourseBuilderService,
    CourseArchitectAgent,
    LessonComposerService,
  ],
  exports: [CourseBuilderService],
})
export class CourseBuilderModule {}
