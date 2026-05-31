import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MentorProfile, MentorProfileSchema } from './schemas/mentor-profile.schema';
import { MentorSession, MentorSessionSchema } from './schemas/mentor-session.schema';
import { MentorsController, MentorSessionsController } from './mentor-marketplace.controller';
import { MentorMarketplaceService } from './mentor-marketplace.service';

/**
 * Phase 9 · Mentor Marketplace — mentor profiles students can browse and request sessions from
 * (project/interview/portfolio/roadmap reviews). Completed sessions write a mentor-verified ledger
 * event back to the student's proof timeline.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MentorProfile.name, schema: MentorProfileSchema },
      { name: MentorSession.name, schema: MentorSessionSchema },
    ]),
    UsersModule,
    LedgerModule,
  ],
  controllers: [MentorsController, MentorSessionsController],
  providers: [MentorMarketplaceService],
  exports: [MentorMarketplaceService],
})
export class MentorMarketplaceModule {}
