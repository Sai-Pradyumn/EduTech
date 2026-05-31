import { Injectable } from '@nestjs/common';
import { AgentType, Intent } from '../../../common/enums';
import { AgentResponse, ProjectPlanBlock } from '../../ai/types/agent.types';
import { ProjectsService } from '../../projects/services/projects.service';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';
import { LlmComposerService } from '../core/llm-composer.service';
import { personaFor } from '../prompts/personas';

/**
 * ProjectBuilder agent — turns "build a project for X" into a real, persisted project
 * blueprint (tech stack, features, phased Kanban tasks, milestones) openable in the
 * Project Studio. Difficulty + stack adapt to the student's profile.
 */
@Injectable()
export class ProjectBuilderAgentService implements IAgent {
  readonly type = AgentType.ProjectBuilder;

  constructor(
    private readonly projects: ProjectsService,
    private readonly composer: LlmComposerService,
  ) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    const goal = this.extractGoal(ctx.request.message);

    ctx.emit({
      type: 'thinking',
      messageId: '',
      label: 'Scoping the project to your level & stack',
    });
    ctx.emit({
      type: 'tool_call',
      messageId: '',
      tool: 'project.generate',
      label: `Designing a blueprint for "${goal}"`,
    });

    const project = await this.projects.generate(
      ctx.request.userId,
      { goal },
      'agent',
    );

    ctx.emit({
      type: 'tool_result',
      messageId: '',
      tool: 'project.generate',
      summary: `${project.tasks.length} tasks across ${this.phaseCount(project.tasks)} phases · ${project.estimatedWeeks}w`,
    });

    const fallback = [
      `Here's a **${project.difficulty}** build plan for **${project.title}** — ${project.estimatedWeeks} weeks, ${project.tasks.length} tasks.`,
      '',
      `**Stack:** ${project.techStack.join(' · ')}`,
      '',
      'Open it in the Project Studio to work the Kanban board, track milestones and submit when done.',
    ].join('\n');
    const system =
      `${personaFor(AgentType.ProjectBuilder)}\n` +
      `Just scaffolded "${project.title}" (${project.difficulty}, ${project.estimatedWeeks}w, stack: ${project.techStack.join(', ')}; ` +
      `features: ${project.features.slice(0, 5).join(', ')}). Pitch it in 2–3 sentences: what they'll build and the skills it grows. Keep it short.`;
    const answer = await this.composer.streamAnswer(ctx, {
      system,
      fallback,
      agentType: AgentType.ProjectBuilder,
      operation: 'project.pitch',
      temperature: 0.5,
    });

    const block: ProjectPlanBlock = {
      type: 'project_plan',
      title: project.title,
      techStack: project.techStack,
      features: project.features,
      tasks: project.tasks
        .slice(0, 8)
        .map((t) => ({ title: t.title, done: false })),
    };
    ctx.emit({ type: 'visual_block', messageId: '', block });

    return {
      agentType: AgentType.ProjectBuilder,
      intent: Intent.ProjectPlanning,
      mode: 'mixed',
      answer,
      actions: [
        {
          id: 'open',
          label: 'Open in Project Studio',
          kind: 'open_route',
          payload: { route: '/app/projects', projectId: String(project._id) },
        },
        {
          id: 'harder',
          label: 'Make it more advanced',
          kind: 'custom',
          payload: { goal, difficulty: 'advanced' },
        },
      ],
      visualBlocks: [block],
      confidence: 0.9,
      followUpQuestions: [
        `What should I build first in ${project.title}?`,
        `Explain the architecture of ${project.title}`,
      ],
      recommendedNextActions: [
        'Open the Project Studio and start the first task',
        ctx.roadmap
          ? `Tie this project to your roadmap: ${ctx.roadmap.title}`
          : 'Generate a roadmap to sequence your projects',
      ],
    };
  }

  private extractGoal(message: string): string {
    const cleaned = message
      .toLowerCase()
      .replace(
        /^(can you |please )?(help me )?(build|create|make|design|plan|architect)\s+(me\s+)?(a |an )?/i,
        '',
      )
      .replace(/\bproject (for|on|about)\s+/i, '')
      .replace(/[?.!]+$/, '')
      .trim();
    return cleaned || message.trim() || 'a portfolio project';
  }

  private phaseCount(tasks: { phase: string }[]): number {
    return new Set(tasks.map((t) => t.phase)).size;
  }
}
