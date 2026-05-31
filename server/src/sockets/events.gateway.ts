import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppConfig } from '../config/configuration';
import { JwtPayload } from '../common/interfaces';
import { AgentType, Intent } from '../common/enums';
import { AgentOrchestratorService } from '../modules/agents/agent-orchestrator.service';
import { AgentStreamEvent } from '../modules/ai/types/agent.types';

interface AgentSendPayload {
  sessionId?: string;
  message: string;
  mode?: string;
  agentType?: AgentType;
  intent?: Intent;
  source?: string;
  /** RAG scope — restrict retrieval to these documents. */
  documentIds?: string[];
}

/**
 * Realtime agent streaming. Clients connect with `auth: { token }`, then emit
 * `agent.send`; the orchestrator streams workflow + token events back as `agent.event`.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth?.['token'] ??
        client.handshake.headers['authorization']) as string | undefined;
      const clean = token?.replace(/^Bearer\s+/i, '');
      if (!clean) return this.reject(client);
      const payload = await this.jwt.verifyAsync<JwtPayload>(clean, {
        secret: this.config.get('jwt.secret', { infer: true }),
      });
      client.data['userId'] = payload.sub;
      client.data['role'] = payload.role;
      await client.join(`user:${payload.sub}`);
    } catch {
      this.reject(client);
    }
  }

  @SubscribeMessage('agent.send')
  async onAgentSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AgentSendPayload,
  ): Promise<{ ok: boolean; sessionId?: string }> {
    const userId = client.data['userId'] as string | undefined;
    if (!userId) {
      this.reject(client);
      return { ok: false };
    }
    if (!payload?.message?.trim()) return { ok: false };

    const msgPreview = payload.message.slice(0, 60);
    this.logger.log(
      `[WS] agent.send from user ${userId} | agent: ${payload.agentType ?? 'auto'} | message: "${msgPreview}${payload.message.length > 60 ? '...' : ''}"`
    );

    const emit = (event: AgentStreamEvent) => client.emit('agent.event', event);
    try {
      const result = await this.orchestrator.handle(
        {
          userId,
          role: client.data['role'],
          message: payload.message,
          intent: payload.intent,
          agentType: payload.agentType,
          sessionId: payload.sessionId,
          source: 'chat',
          context: this.buildContext(payload),
        },
        emit,
      );
      this.logger.log(
        `[WS] agent.send completed | sessionId: ${result.sessionId} | messageId: ${result.messageId}`
      );
      return { ok: true, sessionId: result.sessionId };
    } catch (err) {
      this.logger.error(
        `[WS] agent.send FAILED | error: ${(err as Error).message}`
      );
      return { ok: false };
    }
  }

  private buildContext(
    payload: AgentSendPayload,
  ): Record<string, unknown> | undefined {
    const ctx: Record<string, unknown> = {};
    if (payload.mode) ctx['mode'] = payload.mode;
    if (payload.documentIds?.length) ctx['documentIds'] = payload.documentIds;
    return Object.keys(ctx).length ? ctx : undefined;
  }

  /** Push a notification/event to a specific user (used by other services later). */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  private reject(client: Socket): void {
    client.emit('agent.event', {
      type: 'error',
      messageId: '',
      message: 'Unauthorized socket',
    });
    client.disconnect(true);
  }
}
