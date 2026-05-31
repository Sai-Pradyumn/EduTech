import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces';
import { FeedbackService } from '../ai-evals/feedback.service';
import { LlmGatewayService } from '../ai/gateway/llm-gateway.service';
import { NextAction } from '../ai/types/agent.types';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentContextService } from './core/agent-context.service';
import { AgentToolRegistryService } from './core/agent-tool-registry.service';
import { NextActionService } from './core/next-action.service';
import { AgentSessionService } from './core/agent-session.service';
import { AgentMessageDto, FeedbackDto } from './dto/agent.dto';
import {
  AgentMessageView,
  AgentSessionSummary,
  toMessageView,
  toSessionSummary,
} from './dto/agent-response.dto';

/** REST entry to the Agent OS. The streaming path is the WebSocket gateway;
 *  this non-streaming endpoint returns the full response (fallback / tools). */
@Controller('ai')
export class AiAgentController {
  constructor(
    private readonly orchestrator: AgentOrchestratorService,
    private readonly sessions: AgentSessionService,
    private readonly feedback: FeedbackService,
    private readonly context: AgentContextService,
    private readonly nextAction: NextActionService,
    private readonly gateway: LlmGatewayService,
    private readonly toolRegistry: AgentToolRegistryService,
  ) {}

  /** AI provider chain + health snapshot (ops). Admin-only. */
  @Get('providers')
  @Roles(Role.Admin)
  providers() {
    return this.gateway.snapshot();
  }

  /** Registered agent tools (the read-only actions agents may call). Admin-only. */
  @Get('tools')
  @Roles(Role.Admin)
  tools() {
    return this.toolRegistry.list();
  }

  /** Proactive "Your next move" — the system's decision on what the student should do next. */
  @Get('next-action')
  async next(@CurrentUser() user: AuthUser): Promise<NextAction> {
    const loaded = await this.context.load(user.id);
    return this.nextAction.decide({
      profile: loaded.profile,
      roadmap: loaded.roadmap,
    });
  }

  @Post('agent/message')
  async message(@CurrentUser() user: AuthUser, @Body() dto: AgentMessageDto) {
    const result = await this.orchestrator.handle({
      userId: user.id,
      role: user.role,
      message: dto.message,
      agentType: dto.agentType,
      sessionId: dto.sessionId,
      source: 'chat',
      context: this.buildContext(dto),
    });
    return {
      sessionId: result.sessionId,
      messageId: result.messageId,
      response: result.response,
    };
  }

  private buildContext(
    dto: AgentMessageDto,
  ): Record<string, unknown> | undefined {
    const ctx: Record<string, unknown> = {};
    if (dto.mode) ctx['mode'] = dto.mode;
    if (dto.documentIds?.length) ctx['documentIds'] = dto.documentIds;
    return Object.keys(ctx).length ? ctx : undefined;
  }

  @Get('sessions')
  async listSessions(
    @CurrentUser() user: AuthUser,
  ): Promise<AgentSessionSummary[]> {
    const list = await this.sessions.listSessions(user.id);
    return list.map(toSessionSummary);
  }

  @Get('sessions/:id')
  async sessionMessages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<AgentMessageView[]> {
    const msgs = await this.sessions.getMessages(user.id, id);
    return msgs.map(toMessageView);
  }

  @Post('feedback')
  async submitFeedback(
    @CurrentUser() user: AuthUser,
    @Body() dto: FeedbackDto,
  ) {
    await this.feedback.submit(user.id, dto);
    return { ok: true };
  }
}
