import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProgressionService } from './progression.service';

/**
 * Autonomous progression (Phase 4 · Orchestration 2.0). Subscribes to learning-milestone
 * events emitted across the app and proactively nudges the student to the next step.
 */
@Module({
  imports: [NotificationsModule],
  providers: [ProgressionService],
})
export class ProgressionModule {}
