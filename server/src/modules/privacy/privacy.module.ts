import { Module } from '@nestjs/common';
import { SkillPassportModule } from '../skill-passport/skill-passport.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { SkillTwinModule } from '../skill-twin/skill-twin.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ResumeModule } from '../resume/resume.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

/**
 * Phase 9 · Privacy, Export & Reset — learner control over Phase-9 proof/outcome data:
 * export JSON, take public profile/portfolio private, reset Skill Twin, clear application tracker.
 */
@Module({
  imports: [
    SkillPassportModule,
    PortfolioModule,
    SkillTwinModule,
    LedgerModule,
    ResumeModule,
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
