import { Injectable, Logger } from '@nestjs/common';
import { Intent } from '../../common/enums';
import {
  AgentRequest,
  AgentResponse,
  AgentStreamEvent,
  StreamEmit,
} from '../ai/types/agent.types';
import { ResponseValidatorService } from '../ai-evals/response-validator.service';
import { AiRateLimitService } from '../ai/guards/ai-rate-limit.service';
import { PromptInjectionGuard } from '../ai/guards/prompt-injection.guard';
import { AgentRouterService } from './core/agent-router.service';
import { AgentContextService } from './core/agent-context.service';
import {
  ChatCommandRegistryService,
  ChatCommandResult,
} from './core/chat-command-registry.service';
import { ChatCommandSuggestService } from './core/chat-command-suggest.service';
import { AgentRegistryService } from './core/agent-registry.service';
import { AgentSessionService } from './core/agent-session.service';
import { AgentMemoryService } from './core/agent-memory.service';
import { AgentObservabilityService } from './core/agent-observability.service';
import { PlannerService } from './core/planner.service';
import { NextActionService } from './core/next-action.service';
import { AgentRuntimeContext } from './core/agent.interface';

export interface OrchestratorResult {
  sessionId: string;
  messageId: string;
  response: AgentResponse;
}

/**
 * The Agent OS pipeline: classify (LLM + rule fallback) → plan → run the agent step(s)
 * (streaming workflow events) → synthesize → attach the proactive next action → validate
 * → persist. Most messages resolve to a single step; compound asks chain a short plan
 * threading one session. Used by both REST (no-op emit) and the WebSocket gateway.
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    private readonly sessions: AgentSessionService,
    private readonly router: AgentRouterService,
    private readonly planner: PlannerService,
    private readonly context: AgentContextService,
    private readonly registry: AgentRegistryService,
    private readonly memory: AgentMemoryService,
    private readonly observability: AgentObservabilityService,
    private readonly validator: ResponseValidatorService,
    private readonly nextAction: NextActionService,
    private readonly rateLimit: AiRateLimitService,
    private readonly injection: PromptInjectionGuard,
    private readonly commands: ChatCommandRegistryService,
    private readonly commandSuggest: ChatCommandSuggestService,
  ) {}

  async handle(
    request: AgentRequest,
    emit: StreamEmit = () => {},
  ): Promise<OrchestratorResult> {
    // Cost/abuse protection: per-user AI rate limit (throws 429 when exceeded).
    this.rateLimit.enforce(request.userId);

    const trace = this.observability.start();
    const session = await this.sessions.ensureSession(
      request.userId,
      request.sessionId,
      request.source,
    );
    const sessionId = session.id as string;

    this.logger.log(
      `[ORCHESTRATOR] Starting pipeline | sessionId: ${sessionId} | requestedAgent: ${request.agentType ?? 'auto'} | message: "${request.message.slice(0, 50)}..."`,
    );

    // Prior turns (before we append the current message) → multi-turn coherence.
    const history = await this.sessions.recentHistory(
      request.userId,
      sessionId,
    );

    const userMsg = await this.sessions.addUserMessage(
      request.userId,
      sessionId,
      request.message,
    );
    const messageId = userMsg.id as string;
    const tagged: StreamEmit = (e: AgentStreamEvent) =>
      emit({ ...e, messageId });

    // 1) Classify (LLM when live, keyword fallback) and extract entities.
    const classification = await this.router.classify(
      request.message,
      request.intent,
    );
    const intent = classification.intent;

    // 2) Plan (usually one step; compound asks chain agents).
    const plan = this.planner.plan(
      request.message,
      classification,
      request.agentType,
    );
    const primaryAgent = plan.steps[0].agentType;
    this.logger.log(
      `[ORCHESTRATOR] Classification complete | intent: ${intent} | agents: ${plan.steps.map((s) => s.agentType).join(' → ')}`,
    );
    trace.step(
      'classify',
      `Intent: ${intent} → ${plan.steps.map((s) => s.agentType).join(' → ')}`,
    );

    emit({ type: 'started', sessionId, messageId, agentType: primaryAgent });
    emit({
      type: 'plan',
      messageId,
      steps: plan.steps,
      rationale: plan.rationale,
    });

    try {
      // 2.5) Chat commands: unambiguous asks ("mark week 2 complete", "refocus
      // week 3 on X") execute REAL state changes now — before context loads — so
      // this very turn sees the new state and the reply confirms what happened.
      let executed: ChatCommandResult[] = [];
      if (request.source !== 'admin') {
        executed = await this.commands.detectAndExecute(
          request.userId,
          request.message,
        );
        for (const r of executed) {
          trace.step('command', r.summary);
          tagged({
            type: 'tool_result',
            messageId,
            tool: 'chat_command',
            summary: r.summary,
          });
        }
      }

      // "Did you mean" for near-miss commands: runs in parallel with the agent
      // pass (no added latency) and only ever produces a click-to-confirm chip.
      const suggestPromise: Promise<string | null> =
        executed.length === 0 && request.source !== 'admin'
          ? this.commandSuggest.suggest(request.userId, request.message)
          : Promise.resolve(null);

      trace.step(
        'context',
        'Loading learner context (profile, activity, memory)',
      );
      const loaded = await this.context.load(
        request.userId,
        request.message,
        primaryAgent,
      );

      // Screen for prompt injection; when flagged, harden the agent system prompt.
      const injection = this.injection.inspect(request.message);
      const baseContext: Record<string, unknown> = {
        ...(request.context ?? {}),
        ...(classification.entities.topic
          ? { topic: classification.entities.topic }
          : {}),
        ...(classification.entities.difficulty
          ? { difficulty: classification.entities.difficulty }
          : {}),
        ...(injection.flagged
          ? { securityNote: this.injection.defenseNote }
          : {}),
        ...(executed.length
          ? { executedCommands: executed.map((r) => r.summary) }
          : {}),
      };

      const responses: AgentResponse[] = [];
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        emit({
          type: 'step_started',
          messageId,
          index: i,
          agentType: step.agentType,
          goal: step.goal,
        });
        if (i > 0)
          tagged({ type: 'chunk', messageId: '', delta: '\n\n---\n\n' });

        const stepCtx: AgentRuntimeContext = {
          request: {
            ...request,
            intent,
            message: i === 0 ? request.message : step.goal,
            context: baseContext,
          },
          profile: loaded.profile,
          roadmap: loaded.roadmap,
          memories: loaded.memories,
          facts: loaded.facts,
          history,
          summary: session.summary,
          emit: tagged,
        };

        const agent = this.registry.get(step.agentType);
        trace.step('generate', `Running ${agent.type} agent`);
        const raw = await agent.handle(stepCtx);
        responses.push(
          this.validator.validate(raw, {
            agentType: agent.type,
            intent,
            answer: 'I had trouble forming a full answer — could you rephrase?',
          }),
        );
        emit({
          type: 'step_completed',
          messageId,
          index: i,
          agentType: step.agentType,
        });
      }

      const response = this.synthesize(responses);
      // Executed commands lead the reply — the state change is the headline, the
      // agent's prose is the follow-through. A review chip links to the change.
      if (executed.length) {
        const confirmations = executed
          .map((r) => (r.ok ? `✅ ${r.summary}` : `⚠️ ${r.summary}`))
          .join('\n');
        response.answer = `${confirmations}\n\n${response.answer}`;
        response.actions = [
          ...executed
            .filter((r) => r.ok && r.route)
            .map((r, i) => ({
              id: `cmd_${i}`,
              label: r.routeLabel ?? 'Review the change',
              kind: 'open_route' as const,
              payload: { route: r.route },
            })),
          // One-click undo: the inverse command goes back through the same path.
          ...executed
            .filter((r) => r.ok && r.undo)
            .map((r, i) => ({
              id: `undo_${i}`,
              label: 'Undo',
              kind: 'custom' as const,
              payload: { sendText: r.undo!.text },
            })),
          ...response.actions,
        ].slice(0, 6);
      }
      const didYouMean = await suggestPromise;
      if (didYouMean) {
        response.actions = [
          {
            id: 'cmd_suggest',
            label: `Did you mean: “${didYouMean}”?`,
            kind: 'custom' as const,
            payload: { sendText: didYouMean },
          },
          ...response.actions,
        ].slice(0, 6);
      }
      // 3) Proactive next move from the learner's state.
      response.nextAction = this.nextAction.decide({
        profile: loaded.profile,
        roadmap: loaded.roadmap,
      });

      trace.step('persist', 'Saving message & memory');
      const assistant = await this.sessions.addAssistantMessage(
        request.userId,
        sessionId,
        response,
      );
      await this.rememberTopic(request, intent, classification.entities.topic);
      void this.sessions.maybeSummarize(request.userId, sessionId); // fire-and-forget for next turn

      await this.observability.persist(request.userId, primaryAgent, trace, {
        sessionId,
        success: true,
      });
      const assistantId = assistant.id as string;
      emit({ type: 'completed', messageId: assistantId, response });
      return { sessionId, messageId: assistantId, response };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Orchestrator failure: ${message}`);
      await this.observability.persist(request.userId, primaryAgent, trace, {
        sessionId,
        success: false,
        error: message,
      });
      emit({
        type: 'error',
        messageId,
        message: 'The agent hit an error. Please try again.',
      });
      throw err;
    }
  }

  /** One step → that response; multiple → merge into a single coherent answer. */
  private synthesize(responses: AgentResponse[]): AgentResponse {
    if (responses.length === 1) return responses[0];
    const head = responses[0];
    return {
      ...head,
      answer: responses.map((r) => r.answer).join('\n\n---\n\n'),
      actions: responses.flatMap((r) => r.actions).slice(0, 6),
      visualBlocks: responses.flatMap((r) => r.visualBlocks),
      sources: responses.flatMap((r) => r.sources ?? []),
      confidence:
        Math.round(
          (responses.reduce((s, r) => s + r.confidence, 0) / responses.length) *
            100,
        ) / 100,
      followUpQuestions: [
        ...new Set(responses.flatMap((r) => r.followUpQuestions)),
      ].slice(0, 4),
      recommendedNextActions: [
        ...new Set(responses.flatMap((r) => r.recommendedNextActions)),
      ].slice(0, 4),
    };
  }

  private async rememberTopic(
    request: AgentRequest,
    intent: Intent,
    topic?: string,
  ): Promise<void> {
    if (intent === Intent.ConceptExplanation) {
      const t =
        topic ??
        request.message
          .replace(/^(explain|what is|teach me)\s+/i, '')
          .slice(0, 80);
      await this.memory.remember(
        request.userId,
        'fact',
        `Studied: ${t}`,
        1,
        'tutor',
      );
    }
  }
}
