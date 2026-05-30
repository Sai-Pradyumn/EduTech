import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { AgentType, Difficulty, ItemStatus, SkillLevel } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { StudentProfileService } from '../../student-profile/student-profile.service';
import { Project, ProjectDocument, ProjectSource, ProjectStatus } from '../schemas/project.schema';
import { GenerateProjectDto, SubmitProjectDto } from '../dto/project.dto';
import { Blueprint, ProjectBlueprintGenerator } from './project-blueprint.generator';
import { ProjectReviewGenerator } from './project-review.generator';

export interface ProjectStats {
  total: number;
  completed: number;
  inProgress: number;
  submitted: number;
  avgProgress: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    private readonly profiles: StudentProfileService,
    private readonly blueprint: ProjectBlueprintGenerator,
    private readonly reviewer: ProjectReviewGenerator,
    private readonly ai: AiService,
  ) {}

  async generate(userId: string, dto: GenerateProjectDto, source: ProjectSource = 'goal'): Promise<ProjectDocument> {
    const profile = await this.profiles.findByUser(userId);
    const difficulty = dto.difficulty ?? this.difficultyFor(profile?.currentSkillLevel);
    const bp: Blueprint = this.blueprint.generate(dto.goal.trim(), profile?.currentSkills ?? [], difficulty);

    const project = await this.projects.create({
      user: new Types.ObjectId(userId),
      title: bp.title,
      goal: dto.goal.trim(),
      summary: bp.summary,
      techStack: bp.techStack,
      features: bp.features,
      learningGoals: bp.learningGoals,
      difficulty,
      estimatedWeeks: bp.estimatedWeeks,
      status: 'planning',
      source,
      tasks: bp.tasks,
      milestones: bp.milestones,
      progressPercentage: 0,
    });
    await this.ai.logUsage({ userId, agentType: AgentType.ProjectBuilder, operation: 'project.generate' });
    return project;
  }

  list(userId: string): Promise<ProjectDocument[]> {
    return this.projects.find({ user: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  get(userId: string, id: string): Promise<ProjectDocument> {
    return this.owned(userId, id);
  }

  async moveTask(userId: string, id: string, taskId: string, status: ItemStatus): Promise<ProjectDocument> {
    const project = await this.owned(userId, id);
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) throw new NotFoundException('Task not found');
    task.status = status;
    this.recompute(project);
    await project.save();
    return project;
  }

  async addTask(userId: string, id: string, title: string, description = '', phase = 'Core features'): Promise<ProjectDocument> {
    const project = await this.owned(userId, id);
    const order = project.tasks.reduce((m, t) => Math.max(m, t.order), 0) + 1;
    project.tasks.push({ id: randomUUID(), title, description, status: ItemStatus.Todo, order, phase, estimateHours: 2 });
    this.recompute(project);
    await project.save();
    return project;
  }

  async removeTask(userId: string, id: string, taskId: string): Promise<ProjectDocument> {
    const project = await this.owned(userId, id);
    project.tasks = project.tasks.filter((t) => t.id !== taskId);
    this.recompute(project);
    await project.save();
    return project;
  }

  async setStatus(userId: string, id: string, status: ProjectStatus): Promise<ProjectDocument> {
    const project = await this.owned(userId, id);
    project.status = status;
    await project.save();
    return project;
  }

  async submit(userId: string, id: string, dto: SubmitProjectDto): Promise<ProjectDocument> {
    const project = await this.owned(userId, id);
    project.submission = {
      githubUrl: dto.githubUrl,
      demoUrl: dto.demoUrl,
      videoUrl: dto.videoUrl,
      notes: dto.notes ?? '',
      submittedAt: new Date(),
    };
    project.status = 'completed';
    project.tasks.forEach((t) => (t.status = ItemStatus.Done));
    this.recompute(project);
    await project.save();
    await this.ai.logUsage({ userId, agentType: AgentType.ProjectBuilder, operation: 'project.submit' });
    // B8: auto-run the AI review so the student gets feedback immediately on submit.
    return this.runAiReview(userId, project);
  }

  /** (Re)generate the AI review for a submitted project (Phase 4 · B8). */
  async generateAiReview(userId: string, id: string): Promise<ProjectDocument> {
    const project = await this.owned(userId, id);
    if (!project.submission?.submittedAt) throw new BadRequestException('Submit the project before requesting a review.');
    return this.runAiReview(userId, project);
  }

  /** Toggle one improvement-checklist item done/undone. */
  async toggleImprovement(userId: string, id: string, itemId: string, done: boolean): Promise<ProjectDocument> {
    const project = await this.owned(userId, id);
    const item = project.aiReview?.improvements.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Checklist item not found');
    item.done = done;
    project.markModified('aiReview');
    await project.save();
    return project;
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const project = await this.owned(userId, id);
    await this.projects.deleteOne({ _id: project._id }).exec();
    return { ok: true };
  }

  /** Submitted projects for a set of students (mentor review queue). */
  async submittedForUsers(userIds: string[]): Promise<ProjectDocument[]> {
    if (userIds.length === 0) return [];
    return this.projects
      .find({
        user: { $in: userIds.map((id) => new Types.ObjectId(id)) },
        'submission.submittedAt': { $exists: true },
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /** A mentor approves or requests changes on a submitted project. */
  async mentorReview(
    reviewerId: string,
    reviewerName: string,
    projectId: string,
    decision: 'approved' | 'changes_requested',
    feedback: string,
    score?: number,
  ): Promise<ProjectDocument> {
    if (!Types.ObjectId.isValid(projectId)) throw new NotFoundException('Project not found');
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (!project.submission?.submittedAt) throw new BadRequestException('Project has not been submitted yet.');
    project.mentorReview = {
      reviewer: new Types.ObjectId(reviewerId),
      reviewerName,
      decision,
      feedback,
      score,
      reviewedAt: new Date(),
    };
    if (decision === 'changes_requested') project.status = 'in_progress';
    await project.save();
    return project;
  }

  /** Lightweight stats for the Learning-Intelligence cockpit. */
  async stats(userId: string): Promise<ProjectStats> {
    const list = await this.projects.find({ user: new Types.ObjectId(userId) }).lean<ProjectDocument[]>().exec();
    const completed = list.filter((p) => p.status === 'completed').length;
    const inProgress = list.filter((p) => p.status === 'in_progress').length;
    const submitted = list.filter((p) => p.submission?.submittedAt).length;
    const avgProgress = list.length ? Math.round(list.reduce((s, p) => s + p.progressPercentage, 0) / list.length) : 0;
    return { total: list.length, completed, inProgress, submitted, avgProgress };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  /** Scores the project deterministically, then asks the provider for a short narrative. */
  private async runAiReview(userId: string, project: ProjectDocument): Promise<ProjectDocument> {
    const draft = this.reviewer.generate(project);
    const summary = this.reviewSummary(project, draft);
    project.aiReview = {
      qualityScore: draft.qualityScore,
      architectureScore: draft.architectureScore,
      completenessScore: draft.completenessScore,
      resumeScore: draft.resumeScore,
      overallScore: draft.overallScore,
      summary,
      strengths: draft.strengths,
      improvements: draft.improvements,
      reviewedAt: new Date(),
      model: this.ai.providerName,
    };
    project.markModified('aiReview');
    await project.save();
    await this.ai.logUsage({ userId, agentType: AgentType.ProjectBuilder, operation: 'project.ai_review' });
    return project;
  }

  /**
   * Deterministic 2-3 sentence reviewer note composed from the scored draft — same approach
   * as the roadmap/quiz/blueprint generators (the AI abstraction stays deterministic under
   * the default MockAIProvider; a real provider would slot in for richer prose later).
   */
  private reviewSummary(project: ProjectDocument, draft: { overallScore: number; strengths: string[]; improvements: { text: string }[] }): string {
    const band = draft.overallScore >= 80 ? 'strong' : draft.overallScore >= 60 ? 'solid' : draft.overallScore >= 40 ? 'a promising start' : 'an early draft';
    const lead = `${project.title} scores ${draft.overallScore}/100 — ${band}.`;
    const strength = draft.strengths[0] ?? 'The scope is well-defined.';
    const next = draft.improvements[0] ? ` Your highest-impact next step: ${draft.improvements[0].text.toLowerCase()}` : ' Focus on polish to finish strong.';
    return `${lead} ${strength}${next}`;
  }

  private recompute(project: ProjectDocument): void {
    const total = project.tasks.length;
    const done = project.tasks.filter((t) => t.status === ItemStatus.Done).length;
    project.progressPercentage = total ? Math.round((done / total) * 100) : 0;
    // Auto-advance status from progress unless explicitly completed.
    if (project.status !== 'completed') {
      project.status = done === 0 ? 'planning' : done === total && total > 0 ? 'completed' : 'in_progress';
    }
    // Mark milestones reached as progress crosses thresholds.
    const thresholds = [10, 70, 100];
    project.milestones.forEach((m, i) => {
      if (project.progressPercentage >= (thresholds[i] ?? 100)) m.reached = true;
    });
  }

  private difficultyFor(level?: SkillLevel): Difficulty {
    if (level === SkillLevel.Advanced) return Difficulty.Advanced;
    if (level === SkillLevel.Intermediate) return Difficulty.Intermediate;
    return Difficulty.Beginner;
  }

  private async owned(userId: string, id: string): Promise<ProjectDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Project not found');
    const project = await this.projects.findOne({ _id: id, user: new Types.ObjectId(userId) });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
