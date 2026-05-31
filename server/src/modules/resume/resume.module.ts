import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkillPassportModule } from '../skill-passport/skill-passport.module';
import { ProjectsModule } from '../projects/projects.module';
import { CareerReadinessModule } from '../career-readiness/career-readiness.module';
import { Resume, ResumeSchema } from './schemas/resume.schema';
import { Application, ApplicationSchema } from './schemas/application.schema';
import { ApplicationsController, ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';
import { ApplicationService } from './application.service';
import { ApplicationAgent, ResumeAgent } from './resume.agents';

/**
 * Phase 9 · Resume & Application Assistant — generate a resume from verified evidence, analyze a
 * pasted JD into a match score + missing skills + tailored cover letter, and track applications.
 * Privacy-friendly: manual JD paste only, no scraping.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Resume.name, schema: ResumeSchema },
      { name: Application.name, schema: ApplicationSchema },
    ]),
    SkillPassportModule,
    ProjectsModule,
    CareerReadinessModule,
  ],
  controllers: [ResumeController, ApplicationsController],
  providers: [ResumeService, ApplicationService, ResumeAgent, ApplicationAgent],
  exports: [ResumeService, ApplicationService],
})
export class ResumeModule {}
