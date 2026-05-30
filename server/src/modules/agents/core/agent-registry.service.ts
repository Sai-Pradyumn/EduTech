import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { IAgent } from './agent.interface';
import { TutorAgentService } from '../agents/tutor-agent.service';
import { MentorAgentService } from '../agents/mentor-agent.service';
import { RagAgentService } from '../agents/rag-agent.service';
import { AssessmentAgentService } from '../agents/assessment-agent.service';
import { ProjectBuilderAgentService } from '../agents/project-builder-agent.service';
import { DoubtSolverAgentService } from '../agents/doubt-solver-agent.service';
import { CareerAgentService } from '../agents/career-agent.service';
import { ContentCreatorAgentService } from '../agents/content-creator-agent.service';
import { AdminInsightAgentService } from '../agents/admin-insight-agent.service';

/**
 * Maps an AgentType to its handler. Agents not yet implemented fall back to the
 * Tutor so every intent still produces a useful response (clearly logged).
 */
@Injectable()
export class AgentRegistryService {
  private readonly registry = new Map<AgentType, IAgent>();

  constructor(
    tutor: TutorAgentService,
    mentor: MentorAgentService,
    rag: RagAgentService,
    assessment: AssessmentAgentService,
    projectBuilder: ProjectBuilderAgentService,
    doubt: DoubtSolverAgentService,
    career: CareerAgentService,
    content: ContentCreatorAgentService,
    adminInsight: AdminInsightAgentService,
  ) {
    this.registry.set(AgentType.Tutor, tutor);
    this.registry.set(AgentType.Mentor, mentor);
    this.registry.set(AgentType.Rag, rag);
    this.registry.set(AgentType.Assessment, assessment);
    this.registry.set(AgentType.ProjectBuilder, projectBuilder);
    this.registry.set(AgentType.DoubtSolver, doubt);
    this.registry.set(AgentType.Career, career);
    this.registry.set(AgentType.ContentCreator, content);
    this.registry.set(AgentType.AdminInsight, adminInsight);
  }

  get(type: AgentType): IAgent {
    return this.registry.get(type) ?? this.registry.get(AgentType.Tutor)!;
  }

  isImplemented(type: AgentType): boolean {
    return this.registry.has(type);
  }
}
