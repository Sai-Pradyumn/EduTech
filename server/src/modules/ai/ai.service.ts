import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType } from '../../common/enums';
import { LlmGatewayService } from './gateway/llm-gateway.service';
import { estimateCostUsd, estimateTokens } from './gateway/pricing';
import {
  AI_PROVIDER_TOKEN,
  AIMessage,
  GenOptions,
  IAIProvider,
  TokenUsage,
} from './interfaces/ai-provider.interface';
import { AiUsageLog, AiUsageLogDocument } from './schemas/ai-usage-log.schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { FeatureKey } from '../billing/plans';

/** Maps a tagged AI `feature` to the entitlement counter it should consume (Phase 10 · M2). */
const FEATURE_METER_MAP: Record<string, FeatureKey | undefined> = {
  flow: 'flow.generations',
  visual: 'visual.generations',
  quiz: 'quiz.generations',
  assessment: 'quiz.generations',
  simulation: 'simulation.sessions',
  project: 'project.reviews',
};

/** Instruction for the refine strategy's critic pass. */
const CRITIC_INSTRUCTION =
  'Critique the draft answer above for accuracy, clarity, completeness and helpfulness for the ' +
  'student, then return an improved version. Output ONLY the improved answer (markdown), no preamble.';

export interface UsageMeta {
  userId: string;
  agentType: AgentType;
  operation: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  /** Product feature/module that triggered the call (Phase 10 · M2). */
  feature?: string;
  orgId?: string;
  status?: 'success' | 'error' | 'fallback';
}

/**
 * Thin facade over the active provider (the LLM gateway) that also records honest
 * ai_usage_logs. Agents depend on this, never on a concrete provider. When a call's
 * `opts.meta` is set, the real token usage + estimated cost are logged automatically.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER_TOKEN) private readonly provider: IAIProvider,
    private readonly gateway: LlmGatewayService,
    @InjectModel(AiUsageLog.name)
    private readonly usageModel: Model<AiUsageLogDocument>,
    private readonly entitlements: EntitlementsService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  /** True when at least one real LLM key is configured (used to pick LLM vs deterministic paths). */
  get isLive(): boolean {
    return this.provider.isLive;
  }

  /** Active multi-provider strategy: fallback | parallel | refine. */
  get strategy(): 'fallback' | 'parallel' | 'refine' {
    return this.gateway.strategy;
  }

  /**
   * Produce a complete answer honoring the configured strategy:
   * - fallback → single best provider (default)
   * - refine   → draft, then a distinct provider critiques + improves it
   * - parallel → race providers, then a judge synthesizes the best answer
   * Returns the final text (callers stream it); usage is logged.
   */
  async composeWithStrategy(
    messages: AIMessage[],
    opts?: GenOptions,
  ): Promise<string> {
    const cap = this.captureOpts(opts);
    const started = Date.now();
    let out: string;
    switch (this.gateway.strategy) {
      case 'refine':
        out = await this.gateway.refineText(
          messages,
          CRITIC_INSTRUCTION,
          cap.opts,
        );
        break;
      case 'parallel':
        out = await this.gateway.parallelText(messages, cap.opts);
        break;
      default:
        out = await this.gateway.generateText(messages, cap.opts);
    }
    await this.autolog(opts, messages, out, cap, Date.now() - started);
    return out;
  }

  async generateText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): Promise<string> {
    const cap = this.captureOpts(opts);
    const started = Date.now();
    const out = await this.provider.generateText(messages, cap.opts);
    await this.autolog(opts, messages, out, cap, Date.now() - started);
    return out;
  }

  async *streamText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): AsyncIterable<string> {
    const cap = this.captureOpts(opts);
    const started = Date.now();
    
    this.logger.log(
      `[AI-SERVICE] Calling ${this.provider.name}.streamText | operation: ${opts?.meta?.operation ?? 'unknown'} | isLive: ${this.provider.isLive}`
    );
    
    let acc = '';
    let tokenCount = 0;
    try {
      for await (const token of this.provider.streamText(messages, cap.opts)) {
        acc += token;
        tokenCount++;
        yield token;
      }
      const latencyMs = Date.now() - started;
      this.logger.log(
        `[AI-SERVICE] ${this.provider.name}.streamText completed | tokens: ${tokenCount} | latency: ${latencyMs}ms | response length: ${acc.length} chars`
      );
    } catch (err) {
      const latencyMs = Date.now() - started;
      this.logger.error(
        `[AI-SERVICE] ${this.provider.name}.streamText FAILED after ${latencyMs}ms: ${(err as Error).message}`
      );
      throw err;
    }
    await this.autolog(opts, messages, acc, cap, Date.now() - started);
  }

  async generateStructuredOutput<T>(
    messages: AIMessage[],
    schema: Record<string, unknown>,
    opts?: GenOptions,
  ): Promise<T> {
    const cap = this.captureOpts(opts);
    const started = Date.now();
    const out = await this.provider.generateStructuredOutput<T>(
      messages,
      schema,
      cap.opts,
    );
    await this.autolog(
      opts,
      messages,
      JSON.stringify(out),
      cap,
      Date.now() - started,
    );
    return out;
  }

  generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }

  // ───────────────────────── usage capture ─────────────────────────

  /** Wraps opts.onUsage so we capture real provider usage while preserving the caller's. */
  private captureOpts(opts?: GenOptions): {
    opts: GenOptions | undefined;
    get: () => { usage?: TokenUsage; model: string };
  } {
    let usage: TokenUsage | undefined;
    let model = this.provider.name;
    const wrapped: GenOptions | undefined = opts
      ? {
          ...opts,
          onUsage: (u, m) => {
            usage = u;
            model = m.model;
            opts.onUsage?.(u, m);
          },
        }
      : { onUsage: (u, m) => ((usage = u), (model = m.model)) };
    return { opts: wrapped, get: () => ({ usage, model }) };
  }

  private async autolog(
    opts: GenOptions | undefined,
    messages: AIMessage[],
    output: string,
    cap: { get: () => { usage?: TokenUsage; model: string } },
    latencyMs: number,
  ): Promise<void> {
    const meta = opts?.meta;
    if (!meta?.userId) return; // only attributed calls are logged here
    const { usage, model } = cap.get();
    const tokensIn =
      usage?.promptTokens ??
      estimateTokens(messages.map((m) => m.content).join(' '));
    const tokensOut = usage?.completionTokens ?? estimateTokens(output);
    await this.record({
      userId: meta.userId,
      agentType: (meta.agentType as AgentType) ?? AgentType.Tutor,
      operation: meta.operation ?? 'generate',
      feature: meta.feature,
      orgId: meta.orgId,
      tokensIn,
      tokensOut,
      latencyMs,
      model,
    });
  }

  // ───────────────────────── analytics ─────────────────────────

  /** Platform-wide AI usage aggregate (for the AdminInsight agent / Command Center). */
  async usageSummary(): Promise<{
    totalCalls: number;
    totalTokens: number;
    avgLatencyMs: number;
    byAgent: { agentType: string; count: number }[];
  }> {
    const [totals] = await this.usageModel.aggregate<{
      totalCalls: number;
      totalTokens: number;
      avgLatencyMs: number;
    }>([
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalTokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } },
          avgLatencyMs: { $avg: '$latencyMs' },
        },
      },
    ]);
    const byAgent = await this.usageModel.aggregate<{
      agentType: string;
      count: number;
    }>([
      { $group: { _id: '$agentType', count: { $sum: 1 } } },
      { $project: { _id: 0, agentType: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]);
    return {
      totalCalls: totals?.totalCalls ?? 0,
      totalTokens: totals?.totalTokens ?? 0,
      avgLatencyMs: Math.round(totals?.avgLatencyMs ?? 0),
      byAgent,
    };
  }

  /** Per-agent analytics: count, tokens, avg latency, real cost (Admin Command Center). */
  async agentAnalytics(): Promise<{
    totalCalls: number;
    totalTokens: number;
    avgLatencyMs: number;
    estCostUsd: number;
    byAgent: {
      agentType: string;
      count: number;
      tokens: number;
      avgLatencyMs: number;
      estCostUsd: number;
    }[];
  }> {
    const rows = await this.usageModel.aggregate<{
      _id: string;
      count: number;
      tokens: number;
      avgLatencyMs: number;
      cost: number;
    }>([
      {
        $group: {
          _id: '$agentType',
          count: { $sum: 1 },
          tokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } },
          avgLatencyMs: { $avg: '$latencyMs' },
          cost: { $sum: '$costUsd' },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const byAgent = rows.map((r) => ({
      agentType: r._id,
      count: r.count,
      tokens: r.tokens,
      avgLatencyMs: Math.round(r.avgLatencyMs ?? 0),
      estCostUsd: Math.round((r.cost ?? 0) * 100) / 100,
    }));
    const totalTokens = byAgent.reduce((s, a) => s + a.tokens, 0);
    return {
      totalCalls: byAgent.reduce((s, a) => s + a.count, 0),
      totalTokens,
      avgLatencyMs: byAgent.length
        ? Math.round(
            byAgent.reduce((s, a) => s + a.avgLatencyMs, 0) / byAgent.length,
          )
        : 0,
      estCostUsd:
        Math.round(byAgent.reduce((s, a) => s + a.estCostUsd, 0) * 100) / 100,
      byAgent,
    };
  }

  /**
   * Explicit usage marker (legacy + deterministic operations). Computes real cost from
   * the tokens provided + the active model. Never throws into the caller.
   */
  async logUsage(meta: UsageMeta): Promise<void> {
    return this.record({ ...meta, model: this.provider.name });
  }

  private async record(meta: UsageMeta & { model: string }): Promise<void> {
    try {
      const tokensIn = meta.tokensIn ?? 0;
      const tokensOut = meta.tokensOut ?? 0;
      const feature = meta.feature ?? 'tutor';
      await this.usageModel.create({
        user: new Types.ObjectId(meta.userId),
        org: meta.orgId ? new Types.ObjectId(meta.orgId) : undefined,
        agentType: meta.agentType,
        feature,
        provider: this.provider.name,
        model: meta.model,
        strategy: this.gateway.strategy,
        operation: meta.operation,
        tokensIn,
        tokensOut,
        costUsd: estimateCostUsd(meta.model, tokensIn, tokensOut),
        latencyMs: meta.latencyMs ?? 0,
        status: meta.status ?? 'success',
      });
      // Meter entitlement counters (non-blocking — the call already happened).
      void this.entitlements.consume(meta.userId, 'ai.messages', 1);
      if (tokensIn + tokensOut > 0) {
        void this.entitlements.consume(
          meta.userId,
          'ai.tokens',
          tokensIn + tokensOut,
        );
      }
      // Feature-specific meter, derived from the tagged feature (single source of truth).
      const featureKey = FEATURE_METER_MAP[feature];
      if (featureKey)
        void this.entitlements.consume(meta.userId, featureKey, 1);
    } catch (err) {
      this.logger.warn(`Failed to record AI usage: ${(err as Error).message}`);
    }
  }
}
