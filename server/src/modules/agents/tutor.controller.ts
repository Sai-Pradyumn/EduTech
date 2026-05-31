import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { AgentType } from '../../common/enums';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentSessionService } from './core/agent-session.service';
import { AgentMessageDto } from './dto/agent.dto';
import {
  AgentSessionSummary,
  toSessionSummary,
} from './dto/agent-response.dto';

/** Tutor-scoped convenience endpoints (forces the Tutor agent). Streaming is via WS. */
@Controller('tutor')
export class TutorController {
  constructor(
    private readonly orchestrator: AgentOrchestratorService,
    private readonly sessions: AgentSessionService,
  ) {}

  @Post('ask')
  async ask(@CurrentUser() user: AuthUser, @Body() dto: AgentMessageDto) {
    const result = await this.orchestrator.handle({
      userId: user.id,
      role: user.role,
      message: dto.message,
      agentType: AgentType.Tutor,
      sessionId: dto.sessionId,
      source: 'chat',
      context: dto.mode ? { mode: dto.mode } : undefined,
    });
    return {
      sessionId: result.sessionId,
      messageId: result.messageId,
      response: result.response,
    };
  }

  @Get('sessions')
  async sessions_(
    @CurrentUser() user: AuthUser,
  ): Promise<AgentSessionSummary[]> {
    const list = await this.sessions.listSessions(user.id);
    return list.map(toSessionSummary);
  }
}
