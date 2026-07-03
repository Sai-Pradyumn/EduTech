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
import { AgentType, Intent, Role } from '../common/enums';
import { AgentOrchestratorService } from '../modules/agents/agent-orchestrator.service';
import { AgentStreamEvent } from '../modules/ai/types/agent.types';

/** Typed view over socket.io's untyped `client.data` bag. */
interface SocketData {
  userId?: string;
  role?: Role;
  /** True while an agent run is streaming on this socket (one in flight at a time). */
  busy?: boolean;
}

/** Mirror the HTTP DTO's cap so the WS path can't be used to bypass it. */
const MAX_MESSAGE_LEN = 4000;

interface AgentSendPayload {
  sessionId?: string;
  message: string;
  mode?: string;
  agentType?: AgentType;
  intent?: Intent;
  source?: string;
  /** RAG scope — restrict retrieval to these documents. */
  documentIds?: string[];
  /** Client-generated run id — echoed on every event so one shared socket can
   *  route concurrent/queued streams to the right subscriber (SOCKET-BUG-001). */
  runId?: string;
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
      const data = client.data as SocketData;
      data.userId = payload.sub;
      data.role = payload.role;
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
    const data = client.data as SocketData;
    const userId = data.userId;
    const runId = payload?.runId;
    if (!userId) {
      this.reject(client);
      return { ok: false };
    }
    const message = payload?.message?.trim();
    if (!message) return { ok: false };

    // Mirror the HTTP cap — a streamed message can't be larger than the REST one.
    if (message.length > MAX_MESSAGE_LEN) {
      this.emitError(
        client,
        `Message too long (max ${MAX_MESSAGE_LEN} characters).`,
        runId,
      );
      return { ok: false };
    }

    // One run per socket: a second send while one is streaming would interleave
    // token events and double the cost. The client serializes sends, so this is a
    // safety net — carry the runId so the right subscriber unblocks.
    if (data.busy) {
      this.emitError(
        client,
        'Still answering your previous message — please wait.',
        runId,
      );
      return { ok: false };
    }
    data.busy = true;

    const msgPreview = message.slice(0, 60);
    this.logger.log(
      `[WS] agent.send from user ${userId} | agent: ${payload.agentType ?? 'auto'} | message: "${msgPreview}${message.length > 60 ? '...' : ''}"`,
    );

    // Tag every streamed event with the run id so the client can route it.
    const emit = (event: AgentStreamEvent) =>
      client.emit('agent.event', runId ? { ...event, runId } : event);
    try {
      const result = await this.orchestrator.handle(
        {
          userId,
          role: data.role as Role,
          message,
          intent: payload.intent,
          agentType: payload.agentType,
          sessionId: payload.sessionId,
          source: 'chat',
          context: this.buildContext(payload),
        },
        emit,
      );
      this.logger.log(
        `[WS] agent.send completed | sessionId: ${result.sessionId} | messageId: ${result.messageId}`,
      );
      return { ok: true, sessionId: result.sessionId };
    } catch (err) {
      this.logger.error(
        `[WS] agent.send FAILED | error: ${(err as Error).message}`,
      );
      // Emit a terminal error event so the client's streaming UI unblocks instead
      // of hanging forever waiting for a `completed`/`error` it would never get.
      this.emitError(
        client,
        'Asta could not finish that response. Please try again.',
        runId,
      );
      return { ok: false };
    } finally {
      data.busy = false;
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

  /** Emit a terminal error event on the agent stream (completes the client observable). */
  private emitError(client: Socket, message: string, runId?: string): void {
    client.emit('agent.event', {
      type: 'error',
      messageId: '',
      message,
      ...(runId ? { runId } : {}),
    });
  }

  private reject(client: Socket): void {
    this.emitError(client, 'Unauthorized socket');
    client.disconnect(true);
  }
}
