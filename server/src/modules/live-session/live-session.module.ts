import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { CohortModule } from '../cohort/cohort.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LiveSession, LiveSessionSchema } from './schemas/live-session.schema';
import { LiveSessionController } from './live-session.controller';
import { LiveSessionService } from './services/live-session.service';

/**
 * Live session system (Phase 4 · B4): org/cohort-scoped scheduled sessions with attendance
 * and an AI recap (summary + key points + assignment + suggested quiz topic) generated from
 * the host's notes on end. Leaf consumer — reuses Cohort (student rosters) + Notifications.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: LiveSession.name, schema: LiveSessionSchema }]),
    UsersModule,
    TenancyModule,
    CohortModule,
    NotificationsModule,
  ],
  controllers: [LiveSessionController],
  providers: [LiveSessionService],
  exports: [LiveSessionService],
})
export class LiveSessionModule {}
