import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkillTwinModule } from '../skill-twin/skill-twin.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { ProjectsModule } from '../projects/projects.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { UsersModule } from '../users/users.module';
import {
  SkillPassport,
  SkillPassportSchema,
} from './schemas/skill-passport.schema';
import {
  SkillEvidence,
  SkillEvidenceSchema,
} from './schemas/skill-evidence.schema';
import { SkillPassportController } from './skill-passport.controller';
import { SkillPassportService } from './skill-passport.service';

/**
 * Phase 9 · Skill Passport — a living, verified profile of the learner. Blends the Skill Twin,
 * Proof Ledger, certificates, projects and manually-added evidence into one shareable view with
 * fine-grained privacy controls and a public, unauthenticated profile route.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SkillPassport.name, schema: SkillPassportSchema },
      { name: SkillEvidence.name, schema: SkillEvidenceSchema },
    ]),
    SkillTwinModule,
    LedgerModule,
    CertificatesModule,
    ProjectsModule,
    StudentProfileModule,
    UsersModule,
  ],
  controllers: [SkillPassportController],
  providers: [SkillPassportService],
  exports: [SkillPassportService],
})
export class SkillPassportModule {}
