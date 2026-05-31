import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkillPassportModule } from '../skill-passport/skill-passport.module';
import { ProjectsModule } from '../projects/projects.module';
import { Portfolio, PortfolioSchema } from './schemas/portfolio.schema';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioBuilderAgent } from './portfolio.agent';

/**
 * Phase 9 · Portfolio Builder — generate a public-facing portfolio from verified evidence
 * (Skill Passport + projects + certificates) with AI copy; public route /p/:username.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Portfolio.name, schema: PortfolioSchema },
    ]),
    SkillPassportModule,
    ProjectsModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioBuilderAgent],
  exports: [PortfolioService],
})
export class PortfolioModule {}
