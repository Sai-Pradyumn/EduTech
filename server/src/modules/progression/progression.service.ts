import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PROGRESSION_EVENTS,
  ProjectSubmittedEvent,
  QuizGradedEvent,
  WeekCompletedEvent,
} from './progression.events';

/**
 * The autonomous-progression brain. Listens to learning milestones and decides the next
 * move on the student's behalf — nudging them forward without being asked. Kept reliable
 * and side-effect-light: it notifies + deep-links into the right next step (the heavy
 * artifact work, e.g. weak-area tracking, already happens in the emitting services).
 */
@Injectable()
export class ProgressionService {
  private readonly logger = new Logger(ProgressionService.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(PROGRESSION_EVENTS.quizGraded)
  async onQuizGraded(e: QuizGradedEvent): Promise<void> {
    try {
      if (e.score < 50) {
        const focus = e.weakTopics[0] ?? e.topic;
        await this.notifications.create(e.userId, {
          type: 'progression',
          title: `Let's turn ${focus} around`,
          body: `You scored ${e.score}% on "${e.quizTitle}". Ask the tutor to re-teach ${focus}, then retry — that's the fastest fix.`,
          link: `/app/tutor?prompt=${encodeURIComponent(`Teach me ${focus} from basics, then quiz me again.`)}`,
        });
      } else if (e.score >= 85) {
        await this.notifications.create(e.userId, {
          type: 'progression',
          title: `Strong — ${e.score}% on ${e.topic}!`,
          body: `You've got ${e.topic} down. Ready to level up? Try a harder quiz or build something with it.`,
          link: `/app/quizzes`,
        });
      }
    } catch (err) {
      this.logger.warn(`quiz.graded handler failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(PROGRESSION_EVENTS.weekCompleted)
  async onWeekCompleted(e: WeekCompletedEvent): Promise<void> {
    try {
      await this.notifications.create(e.userId, {
        type: 'progression',
        title: `Week ${e.weekNumber} complete! 🎉`,
        body: e.nextWeekFocus
          ? `Next up in "${e.roadmapTitle}": ${e.nextWeekFocus}. Want a quick checkpoint quiz before you move on?`
          : `You've finished "${e.roadmapTitle}". Time to consolidate with a project!`,
        link: e.nextWeekFocus ? `/app/quizzes` : `/app/projects`,
      });
    } catch (err) {
      this.logger.warn(
        `week.completed handler failed: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent(PROGRESSION_EVENTS.projectSubmitted)
  async onProjectSubmitted(e: ProjectSubmittedEvent): Promise<void> {
    try {
      await this.notifications.create(e.userId, {
        type: 'progression',
        title: `"${e.projectTitle}" submitted ✅`,
        body: `Your AI review is ready. Next: showcase it in the Community, or start a new project to keep the streak going.`,
        link: `/app/projects/${e.projectId}`,
      });
    } catch (err) {
      this.logger.warn(
        `project.submitted handler failed: ${(err as Error).message}`,
      );
    }
  }
}
