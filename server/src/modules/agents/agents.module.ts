import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { RagModule } from '../rag/rag.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ProjectsModule } from '../projects/projects.module';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { Mistake, MistakeSchema } from '../mistakes/schemas/mistake.schema';
import {
  SkillTwinSnapshot,
  SkillTwinSnapshotSchema,
} from '../skill-twin/schemas/skill-twin-snapshot.schema';
import {
  DailyPlan,
  DailyPlanSchema,
} from '../daily-plan/schemas/daily-plan.schema';
import { Course, CourseSchema } from '../course-builder/schemas/course.schema';
import { RoadmapAgentService } from './roadmap/roadmap-agent.service';
import { TutorAgentService } from './agents/tutor-agent.service';
import { MentorAgentService } from './agents/mentor-agent.service';
import { RagAgentService } from './agents/rag-agent.service';
import { AssessmentAgentService } from './agents/assessment-agent.service';
import { ProjectBuilderAgentService } from './agents/project-builder-agent.service';
import { DoubtSolverAgentService } from './agents/doubt-solver-agent.service';
import { CareerAgentService } from './agents/career-agent.service';
import { ContentCreatorAgentService } from './agents/content-creator-agent.service';
import { AdminInsightAgentService } from './agents/admin-insight-agent.service';
import { AgentRouterService } from './core/agent-router.service';
import { AgentContextService } from './core/agent-context.service';
import { ContextEngineService } from './core/context-engine.service';
import { VisualComposerService } from './core/visual-composer.service';
import { LlmComposerService } from './core/llm-composer.service';
import { PlannerService } from './core/planner.service';
import { NextActionService } from './core/next-action.service';
import { AgentMemoryService } from './core/agent-memory.service';
import { AgentObservabilityService } from './core/agent-observability.service';
import { AgentToolRegistryService } from './core/agent-tool-registry.service';
import { ChatCommandRegistryService } from './core/chat-command-registry.service';
import { ChatCommandSuggestService } from './core/chat-command-suggest.service';
import { ToolsRegistrarService } from './core/agent-tools';
import { ToolAugmentationService } from './core/tool-augmentation.service';
import { AgentRegistryService } from './core/agent-registry.service';
import { AgentSessionService } from './core/agent-session.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import {
  AgentSession,
  AgentSessionSchema,
  AgentMessage,
  AgentMessageSchema,
} from './schemas/agent-session.schema';
import { AgentMemory, AgentMemorySchema } from './schemas/agent-memory.schema';
import {
  AgentWorkflowLog,
  AgentWorkflowLogSchema,
} from './schemas/agent-workflow-log.schema';
import { AiAgentController } from './ai-agent.controller';
import { TutorController } from './tutor.controller';

/**
 * The AI Agent Operating System: provider-agnostic agents, orchestration,
 * routing, context, memory, tools, observability and session persistence.
 */
@Module({
  controllers: [AiAgentController, TutorController],
  imports: [
    StudentProfileModule,
    RagModule,
    AssessmentModule,
    ProjectsModule,
    MongooseModule.forFeature([
      { name: AgentSession.name, schema: AgentSessionSchema },
      { name: AgentMessage.name, schema: AgentMessageSchema },
      { name: AgentMemory.name, schema: AgentMemorySchema },
      { name: AgentWorkflowLog.name, schema: AgentWorkflowLogSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
      { name: Mistake.name, schema: MistakeSchema },
      { name: SkillTwinSnapshot.name, schema: SkillTwinSnapshotSchema },
      { name: DailyPlan.name, schema: DailyPlanSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  providers: [
    RoadmapAgentService,
    TutorAgentService,
    MentorAgentService,
    RagAgentService,
    AssessmentAgentService,
    ProjectBuilderAgentService,
    DoubtSolverAgentService,
    CareerAgentService,
    ContentCreatorAgentService,
    AdminInsightAgentService,
    AgentRouterService,
    AgentContextService,
    ContextEngineService,
    LlmComposerService,
    VisualComposerService,
    PlannerService,
    NextActionService,
    AgentMemoryService,
    AgentObservabilityService,
    AgentToolRegistryService,
    ChatCommandRegistryService,
    ChatCommandSuggestService,
    ToolsRegistrarService,
    ToolAugmentationService,
    AgentRegistryService,
    AgentSessionService,
    AgentOrchestratorService,
  ],
  exports: [
    RoadmapAgentService,
    AgentOrchestratorService,
    AgentSessionService,
    AgentMemoryService,
    AgentContextService,
    NextActionService,
    ChatCommandRegistryService,
  ],
})
export class AgentsModule {}
