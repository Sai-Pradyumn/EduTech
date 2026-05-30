import { Injectable, Logger } from '@nestjs/common';
import { Intent } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { AgentRequest, AgentResponse, AgentStreamEvent, StreamEmit } from '../ai/types/agent.types';
import { ResponseValidatorService } from '../ai-evals/response-validator.service';
import { AgentRouterService } from './core/agent-router.service';
import { AgentContextService } from './core/agent-context.service';
import { AgentRegistryService } from './core/agent-registry.service';
import { AgentSessionService } from './core/agent-session.service';
import { AgentMemoryService } from './core/agent-memory.service';
import { AgentObservabilityService } from './core/agent-observability.service';
import { AgentRuntimeContext } from './core/agent.interface';

export interface OrchestratorResult {
  sessionId: string;
  messageId: string;
  response: AgentResponse;
}

/**
 * The Agent OS pipeline: classify → route → load context+memory → run agent
 * (streaming workflow events) → validate → persist → log. Used by both the REST
 * endpoint (no-op emit) and the WebSocket gateway (streams to the client).
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    private readonly sessions: AgentSessionService,
    private readonly router: AgentRouterService,
    private readonly context: AgentContextService,
    private readonly registry: AgentRegistryService,
    private readonly memory: AgentMemoryService,
    private readonly observability: AgentObservabilityService,
    private readonly validator: ResponseValidatorService,
    private readonly ai: AiService,
  ) {}

  async handle(request: AgentRequest, emit: StreamEmit = () => {}): Promise<OrchestratorResult> {
    const trace = this.observability.start();
    const session = await this.sessions.ensureSession(request.userId, request.sessionId, request.source);
    const sessionId = session.id;

    const userMsg = await this.sessions.addUserMessage(request.userId, sessionId, request.message);
    const messageId = userMsg.id;

    // Tag every agent stream event with ids before forwarding.
    const tagged: StreamEmit = (e: AgentStreamEvent) => emit({ ...e, messageId } as AgentStreamEvent);

    const intent = this.router.classifyIntent(request.message, request.intent);
    const agentType = request.agentType ?? this.router.selectAgent(intent);
    trace.step('classify', `Intent: ${intent} → ${agentType}`);
    emit({ type: 'started', sessionId, messageId, agentType });

    try {
      trace.step('context', 'Loading profile, roadmap & memory');
      const loaded = await this.context.load(request.userId);

      const ctx: AgentRuntimeContext = {
        request: { ...request, intent },
        profile: loaded.profile,
        roadmap: loaded.roadmap,
        memories: loaded.memories,
        emit: tagged,
      };

      const agent = this.registry.get(agentType);
      if (!this.registry.isImplemented(agentType)) {
        this.logger.log(`Agent ${agentType} not yet implemented — routing to Tutor fallback.`);
        trace.step('route', `${agentType} not ready → Tutor fallback`);
      }

      trace.step('generate', `Running ${agent.type} agent`);
      const raw = await agent.handle(ctx);
      const response = this.validator.validate(raw, {
        agentType: agent.type,
        intent,
        answer: 'I had trouble forming a full answer — could you rephrase?',
      });

      trace.step('persist', 'Saving message & memory');
      const assistant = await this.sessions.addAssistantMessage(request.userId, sessionId, response);
      await this.rememberTopic(request, intent);

      await this.ai.logUsage({
        userId: request.userId,
        agentType: agent.type,
        operation: 'agent',
        tokensIn: request.message.length,
        tokensOut: response.answer.length,
        latencyMs: trace.elapsed(),
      });
      await this.observability.persist(request.userId, agent.type, trace, { sessionId, success: true });

      emit({ type: 'completed', messageId: assistant.id, response });
      return { sessionId, messageId: assistant.id, response };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Orchestrator failure: ${message}`);
      await this.observability.persist(request.userId, agentType, trace, {
        sessionId,
        success: false,
        error: message,
      });
      emit({ type: 'error', messageId, message: 'The agent hit an error. Please try again.' });
      throw err;
    }
  }

  private async rememberTopic(request: AgentRequest, intent: Intent): Promise<void> {
    if (intent === Intent.ConceptExplanation) {
      const topic = request.message.replace(/^(explain|what is|teach me)\s+/i, '').slice(0, 80);
      await this.memory.remember(request.userId, 'fact', `Studied: ${topic}`, 1, 'tutor');
    }
  }
}
