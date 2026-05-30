import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Difficulty, ItemStatus } from '../../../common/enums';
import { ProjectDocument } from '../schemas/project.schema';

export interface ReviewChecklistDraft {
  id: string;
  text: string;
  severity: 'high' | 'medium' | 'low';
  done: boolean;
}

export interface ProjectReviewDraft {
  qualityScore: number;
  architectureScore: number;
  completenessScore: number;
  resumeScore: number;
  overallScore: number;
  strengths: string[];
  improvements: ReviewChecklistDraft[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Deterministic project-review engine (Phase 4 · B8). Scores a submitted project across
 * four dimensions purely from its structure + submission artifacts, and derives a
 * prioritized improvement checklist. Lives behind the AI abstraction the same way the
 * roadmap/quiz/project-blueprint generators do — static code analysis is a future 🧱.
 */
@Injectable()
export class ProjectReviewGenerator {
  generate(project: ProjectDocument): ProjectReviewDraft {
    const tasks = project.tasks ?? [];
    const done = tasks.filter((t) => t.status === ItemStatus.Done).length;
    const taskRatio = tasks.length ? done / tasks.length : 0;
    const sub = project.submission;
    const hasGithub = !!sub?.githubUrl;
    const hasDemo = !!sub?.demoUrl;
    const hasVideo = !!sub?.videoUrl;
    const notesLen = (sub?.notes ?? '').trim().length;
    const milestonesReached = (project.milestones ?? []).filter((m) => m.reached).length;
    const milestoneTotal = (project.milestones ?? []).length || 1;
    const phases = new Set(tasks.map((t) => t.phase).filter(Boolean)).size;
    const stack = project.techStack ?? [];

    const lowerPhases = tasks.map((t) => `${t.phase} ${t.title}`.toLowerCase()).join(' ');
    const hasTests = /test|spec|jest|cypress|qa/.test(lowerPhases);
    const hasCi = /ci\/cd|deploy|pipeline|github actions/.test(lowerPhases);
    const hasAuth = /auth|login|jwt|session/.test(lowerPhases);

    // ── Completeness: how much of the planned work shipped + is it actually submitted.
    const completenessScore = clamp(
      project.progressPercentage * 0.6 +
        (milestonesReached / milestoneTotal) * 25 +
        (sub?.submittedAt ? 15 : 0),
    );

    // ── Architecture: stack breadth, phase coverage, presence of cross-cutting concerns.
    const architectureScore = clamp(
      Math.min(stack.length, 5) * 8 +
        Math.min(phases, 6) * 6 +
        (hasTests ? 14 : 0) +
        (hasCi ? 10 : 0) +
        (hasAuth ? 6 : 0) +
        this.difficultyBonus(project.difficulty),
    );

    // ── Quality: did the planned tasks actually get finished + milestone discipline.
    const qualityScore = clamp(taskRatio * 60 + (milestonesReached / milestoneTotal) * 25 + (hasTests ? 15 : 0));

    // ── Resume-readiness: is this presentable to a recruiter (live demo, code, walkthrough).
    const resumeScore = clamp(
      (hasGithub ? 28 : 0) +
        (hasDemo ? 30 : 0) +
        (hasVideo ? 12 : 0) +
        Math.min(notesLen, 300) / 300 * 10 +
        completenessScore * 0.2,
    );

    const overallScore = clamp(
      qualityScore * 0.3 + architectureScore * 0.25 + completenessScore * 0.25 + resumeScore * 0.2,
    );

    return {
      qualityScore,
      architectureScore,
      completenessScore,
      resumeScore,
      overallScore,
      strengths: this.strengths({ project, taskRatio, hasGithub, hasDemo, hasTests, phases, stack }),
      improvements: this.improvements({ taskRatio, hasGithub, hasDemo, hasVideo, hasTests, hasCi, notesLen, completenessScore }),
    };
  }

  private difficultyBonus(d: Difficulty): number {
    if (d === Difficulty.Advanced) return 12;
    if (d === Difficulty.Intermediate) return 6;
    return 0;
  }

  private strengths(ctx: {
    project: ProjectDocument;
    taskRatio: number;
    hasGithub: boolean;
    hasDemo: boolean;
    hasTests: boolean;
    phases: number;
    stack: string[];
  }): string[] {
    const out: string[] = [];
    if (ctx.taskRatio >= 0.9) out.push('Nearly all planned tasks were completed — strong follow-through.');
    if (ctx.hasDemo) out.push('A live demo link makes the work immediately verifiable.');
    if (ctx.hasGithub) out.push('Source is published, so reviewers can inspect the code.');
    if (ctx.hasTests) out.push('Includes a testing phase — signals quality awareness.');
    if (ctx.phases >= 4) out.push(`Well-structured across ${ctx.phases} delivery phases.`);
    if (ctx.stack.length >= 3) out.push(`Uses a realistic stack (${ctx.stack.slice(0, 4).join(', ')}).`);
    if (out.length === 0) out.push('Project scope is defined and submitted — a solid base to build on.');
    return out.slice(0, 5);
  }

  private improvements(ctx: {
    taskRatio: number;
    hasGithub: boolean;
    hasDemo: boolean;
    hasVideo: boolean;
    hasTests: boolean;
    hasCi: boolean;
    notesLen: number;
    completenessScore: number;
  }): ReviewChecklistDraft[] {
    const items: { text: string; severity: 'high' | 'medium' | 'low' }[] = [];
    if (!ctx.hasGithub) items.push({ text: 'Publish the source to a public GitHub repo and add the link.', severity: 'high' });
    if (!ctx.hasDemo) items.push({ text: 'Deploy a live demo (Vercel/Netlify/Render) so reviewers can try it.', severity: 'high' });
    if (ctx.taskRatio < 0.8) items.push({ text: 'Finish the remaining planned tasks before considering it done.', severity: 'high' });
    if (!ctx.hasTests) items.push({ text: 'Add automated tests for the core flows to demonstrate reliability.', severity: 'medium' });
    if (!ctx.hasCi) items.push({ text: 'Set up CI (lint + tests on push) for a professional workflow.', severity: 'medium' });
    if (ctx.notesLen < 80) items.push({ text: 'Write a richer README/notes section: problem, approach, and how to run it.', severity: 'medium' });
    if (!ctx.hasVideo) items.push({ text: 'Record a short walkthrough video — great for portfolios and interviews.', severity: 'low' });
    if (items.length === 0) items.push({ text: 'Polish UI details and edge-case handling to push from good to great.', severity: 'low' });
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return items
      .sort((a, b) => rank[a.severity] - rank[b.severity])
      .map((i) => ({ id: randomUUID(), text: i.text, severity: i.severity, done: false }));
  }
}
