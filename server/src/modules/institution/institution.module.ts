import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CohortModule } from '../cohort/cohort.module';
import { CareerReadinessModule } from '../career-readiness/career-readiness.module';
import { UsersModule } from '../users/users.module';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';
import {
  InstitutionAssignment,
  InstitutionAssignmentSchema,
} from './schemas/institution-assignment.schema';

/**
 * Phase 9 · Institution Outcome Layer — cohort placement-readiness analytics for colleges/bootcamps.
 * Reuses cohort + Career Readiness; org-isolated; admin/mentor only. Persists class assignments.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: InstitutionAssignment.name,
        schema: InstitutionAssignmentSchema,
      },
    ]),
    CohortModule,
    CareerReadinessModule,
    UsersModule,
  ],
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
