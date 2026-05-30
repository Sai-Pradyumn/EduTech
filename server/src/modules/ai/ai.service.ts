import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType } from '../../common/enums';
import {
  AI_PROVIDER_TOKEN,
  AIMessage,
  GenOptions,
  IAIProvider,
} from './interfaces/ai-provider.interface';
import { AiUsageLog, AiUsageLogDocument } from './schemas/ai-usage-log.schema';

export interface UsageMeta {
  userId: string;
  agentType: AgentType;
  operation: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
}

/**
 * Thin facade over the active provider that also records ai_usage_logs.
 * Agents depend on this, never on a concrete provider.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER_TOKEN) private readonly provider: IAIProvider,
    @InjectModel(AiUsageLog.name) private readonly usageModel: Model<AiUsageLogDocument>,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  generateText(messages: AIMessage[], opts?: GenOptions): Promise<string> {
    return this.provider.generateText(messages, opts);
  }

  streamText(messages: AIMessage[], opts?: GenOptions): AsyncIterable<string> {
    return this.provider.streamText(messages, opts);
  }

  generateStructuredOutput<T>(
    messages: AIMessage[],
    schema: Record<string, unknown>,
    opts?: GenOptions,
  ): Promise<T> {
    return this.provider.generateStructuredOutput<T>(messages, schema, opts);
  }

  generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }

  /** Platform-wide AI usage aggregate (for the AdminInsight agent / Command Center). */
  async usageSummary(): Promise<{
    totalCalls: number;
    totalTokens: number;
    avgLatencyMs: number;
    byAgent: { agentType: string; count: number }[];
  }> {
    const [totals] = await this.usageModel.aggregate<{ totalCalls: number; totalTokens: number; avgLatencyMs: number }>([
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalTokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } },
          avgLatencyMs: { $avg: '$latencyMs' },
        },
      },
    ]);
    const byAgent = await this.usageModel.aggregate<{ agentType: string; count: number }>([
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

  /** Per-agent analytics: count, tokens, avg latency, estimated cost (Admin Command Center). */
  async agentAnalytics(): Promise<{
    totalCalls: number;
    totalTokens: number;
    avgLatencyMs: number;
    estCostUsd: number;
    byAgent: { agentType: string; count: number; tokens: number; avgLatencyMs: number; estCostUsd: number }[];
  }> {
    const COST_PER_1K = 0.002; // placeholder rate
    const rows = await this.usageModel.aggregate<{ _id: string; count: number; tokens: number; avgLatencyMs: number }>([
      {
        $group: {
          _id: '$agentType',
          count: { $sum: 1 },
          tokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } },
          avgLatencyMs: { $avg: '$latencyMs' },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const byAgent = rows.map((r) => ({
      agentType: r._id,
      count: r.count,
      tokens: r.tokens,
      avgLatencyMs: Math.round(r.avgLatencyMs ?? 0),
      estCostUsd: Math.round((r.tokens / 1000) * COST_PER_1K * 100) / 100,
    }));
    const totalTokens = byAgent.reduce((s, a) => s + a.tokens, 0);
    return {
      totalCalls: byAgent.reduce((s, a) => s + a.count, 0),
      totalTokens,
      avgLatencyMs: byAgent.length ? Math.round(byAgent.reduce((s, a) => s + a.avgLatencyMs, 0) / byAgent.length) : 0,
      estCostUsd: Math.round((totalTokens / 1000) * COST_PER_1K * 100) / 100,
      byAgent,
    };
  }

  /** Best-effort usage logging (placeholder cost). Never throws into the caller. */
  async logUsage(meta: UsageMeta): Promise<void> {
    try {
      await this.usageModel.create({
        user: new Types.ObjectId(meta.userId),
        agentType: meta.agentType,
        provider: this.provider.name,
        operation: meta.operation,
        tokensIn: meta.tokensIn ?? 0,
        tokensOut: meta.tokensOut ?? 0,
        costUsd: 0,
        latencyMs: meta.latencyMs ?? 0,
      });
    } catch (err) {
      this.logger.warn(`Failed to record AI usage: ${(err as Error).message}`);
    }
  }
}
