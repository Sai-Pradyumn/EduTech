import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { ProjectsService } from './services/projects.service';
import { ProjectDocument } from './schemas/project.schema';
import {
  AddTaskDto,
  GenerateProjectDto,
  MoveTaskDto,
  SubmitProjectDto,
  ToggleImprovementDto,
} from './dto/project.dto';

/** Maps a project document to the client view (id, not _id). */
function toView(p: ProjectDocument) {
  return {
    id: String(p._id),
    title: p.title,
    goal: p.goal,
    summary: p.summary,
    techStack: p.techStack,
    features: p.features,
    learningGoals: p.learningGoals,
    difficulty: p.difficulty,
    estimatedWeeks: p.estimatedWeeks,
    status: p.status,
    source: p.source,
    progressPercentage: p.progressPercentage,
    tasks: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      order: t.order,
      phase: t.phase,
      estimateHours: t.estimateHours,
    })),
    milestones: p.milestones.map((m) => ({
      title: m.title,
      description: m.description,
      criteria: m.criteria,
      reached: m.reached,
    })),
    submission: p.submission
      ? {
          githubUrl: p.submission.githubUrl,
          demoUrl: p.submission.demoUrl,
          videoUrl: p.submission.videoUrl,
          notes: p.submission.notes,
          submittedAt: p.submission.submittedAt?.toISOString(),
        }
      : null,
    aiReview: p.aiReview?.reviewedAt
      ? {
          qualityScore: p.aiReview.qualityScore,
          architectureScore: p.aiReview.architectureScore,
          completenessScore: p.aiReview.completenessScore,
          resumeScore: p.aiReview.resumeScore,
          overallScore: p.aiReview.overallScore,
          summary: p.aiReview.summary,
          strengths: p.aiReview.strengths,
          improvements: p.aiReview.improvements.map((i) => ({
            id: i.id,
            text: i.text,
            severity: i.severity,
            done: i.done,
          })),
          model: p.aiReview.model,
          reviewedAt: p.aiReview.reviewedAt.toISOString(),
        }
      : null,
    mentorReview: p.mentorReview?.reviewedAt
      ? {
          reviewerName: p.mentorReview.reviewerName,
          decision: p.mentorReview.decision,
          feedback: p.mentorReview.feedback,
          score: p.mentorReview.score,
          reviewedAt: p.mentorReview.reviewedAt.toISOString(),
        }
      : null,
    createdAt:
      (p as ProjectDocument & { createdAt?: Date }).createdAt?.toISOString() ??
      '',
  };
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateProjectDto,
  ) {
    return toView(await this.projects.generate(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.projects.list(user.id)).map(toView);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.projects.stats(user.id);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.projects.get(user.id, id));
  }

  @Patch(':id/tasks/:taskId')
  async moveTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return toView(
      await this.projects.moveTask(user.id, id, taskId, dto.status),
    );
  }

  @Post(':id/tasks')
  async addTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddTaskDto,
  ) {
    return toView(
      await this.projects.addTask(
        user.id,
        id,
        dto.title,
        dto.description,
        dto.phase,
      ),
    );
  }

  @Delete(':id/tasks/:taskId')
  async removeTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return toView(await this.projects.removeTask(user.id, id, taskId));
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitProjectDto,
  ) {
    return toView(await this.projects.submit(user.id, id, dto));
  }

  @Post(':id/ai-review')
  async aiReview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.projects.generateAiReview(user.id, id));
  }

  @Patch(':id/ai-review/items/:itemId')
  async toggleImprovement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ToggleImprovementDto,
  ) {
    return toView(
      await this.projects.toggleImprovement(user.id, id, itemId, dto.done),
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.remove(user.id, id);
  }
}
