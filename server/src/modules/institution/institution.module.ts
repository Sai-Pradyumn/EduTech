import { Module } from '@nestjs/common';
import { CohortModule } from '../cohort/cohort.module';
import { CareerReadinessModule } from '../career-readiness/career-readiness.module';
import { UsersModule } from '../users/users.module';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';

/**
 * Phase 9 · Institution Outcome Layer — cohort placement-readiness analytics for colleges/bootcamps.
 * Reuses cohort + Career Readiness; org-isolated; admin/mentor only.
 */
@Module({
  imports: [CohortModule, CareerReadinessModule, UsersModule],
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
