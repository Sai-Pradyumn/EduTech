import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PROGRESSION_EVENTS,
  ProjectSubmittedEvent,
  QuizGradedEvent,
  WeekCompletedEvent,
} from '../progression/progression.events';

/**
 * Phase 9 · Nudge Engine — turns domain events into actionable, de-duplicated nudges (notifications)
 * that point the learner at the next outcome step. Uses createUnique to avoid noisy duplicates and
 * never throws into emitters.
 */
@Injectable()
export class NudgeEngine {
  private readonly logger = new Logger(NudgeEngine.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(PROGRESSION_EVENTS.quizGraded)
  async onQuiz(ev: QuizGradedEvent): Promise<void> {
    try {
      if (ev.score < 50) {
        await this.notifications.createUnique(ev.userId, {
          type: 'nudge',
          title: 'A weak area is worth repairing',
          body: `You scored ${ev.score}% on ${ev.topic}. A quick repair loop locks it in before it costs you in an interview.`,
          link: '/app/mistakes',
        });
      } else if (ev.score >= 80) {
        await this.notifications.createUnique(ev.userId, {
          type: 'nudge',
          title: 'Add this win to your Skill Passport',
          body: `Strong ${ev.score}% on ${ev.topic} — make it verifiable proof recruiters can see.`,
          link: '/app/skill-passport',
        });
      }
    } catch (err) {
      this.logger.warn(`quiz nudge failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(PROGRESSION_EVENTS.projectSubmitted)
  async onProject(ev: ProjectSubmittedEvent): Promise<void> {
    try {
      await this.notifications.createUnique(ev.userId, {
        type: 'nudge',
        title: 'Turn your project into proof',
        body: `"${ev.projectTitle}" is in. Add it to your Skill Passport and Portfolio so it counts toward job-readiness.`,
        link: '/app/skill-passport',
      });
    } catch (err) {
      this.logger.warn(`project nudge failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(PROGRESSION_EVENTS.weekCompleted)
  async onWeek(ev: WeekCompletedEvent): Promise<void> {
    try {
      await this.notifications.createUnique(ev.userId, {
        type: 'nudge',
        title: 'Your readiness just moved',
        body: `Week ${ev.weekNumber} done. See how it changed your Career Readiness and what to tackle next.`,
        link: '/app/career-readiness',
      });
    } catch (err) {
      this.logger.warn(`week nudge failed: ${(err as Error).message}`);
    }
  }
}
