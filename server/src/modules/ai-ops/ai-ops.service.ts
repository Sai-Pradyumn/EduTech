import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AiUsageLog,
  AiUsageLogDocument,
} from '../ai/schemas/ai-usage-log.schema';
import { LlmGatewayService } from '../ai/gateway/llm-gateway.service';
import {
  AiBudgetPolicy,
  AiBudgetPolicyDocument,
} from './schemas/ai-budget-policy.schema';

function round(n: number, d = 4): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/**
 * AI Ops analytics (Phase 10 · M2). Aggregations over the enriched ai_usage_logs: cost by
 * day/feature/provider, fallback + error rates, latency, top spenders, plus provider health
 * from the live gateway and CRUD on budget policies. Read-only except budget upserts.
 */
@Injectable()
export class AiOpsService {
  constructor(
    @InjectModel(AiUsageLog.name)
    private readonly usage: Model<AiUsageLogDocument>,
    @InjectModel(AiBudgetPolicy.name)
    private readonly budgets: Model<AiBudgetPolicyDocument>,
    private readonly gateway: LlmGatewayService,
  ) {}

  private since(days: number): Date {
    return new Date(Date.now() - days * 86400_000);
  }

  async overview(days = 30) {
    const since = this.since(days);
    const [agg] = await this.usage.aggregate<{
      calls: number;
      tokens: number;
      cost: number;
      latency: number;
      fallbacks: number;
      errors: number;
    }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          tokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } },
          cost: { $sum: '$costUsd' },
          latency: { $avg: '$latencyMs' },
          fallbacks: {
            $sum: { $cond: [{ $eq: ['$fallbackUsed', true] }, 1, 0] },
          },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
        },
      },
    ]);
    const calls = agg?.calls ?? 0;
    return {
      windowDays: days,
      calls,
      tokens: agg?.tokens ?? 0,
      costUsd: round(agg?.cost ?? 0),
      avgLatencyMs: Math.round(agg?.latency ?? 0),
      fallbackRate: calls ? round((agg?.fallbacks ?? 0) / calls, 3) : 0,
      errorRate: calls ? round((agg?.errors ?? 0) / calls, 3) : 0,
    };
  }

  async costByDay(days = 30) {
    const rows = await this.usage.aggregate<{
      _id: string;
      cost: number;
      calls: number;
    }>([
      { $match: { createdAt: { $gte: this.since(days) } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          cost: { $sum: '$costUsd' },
          calls: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({
      day: r._id,
      costUsd: round(r.cost),
      calls: r.calls,
    }));
  }

  async costByFeature(days = 30) {
    const rows = await this.usage.aggregate<{
      _id: string;
      cost: number;
      calls: number;
      tokens: number;
    }>([
      { $match: { createdAt: { $gte: this.since(days) } } },
      {
        $group: {
          _id: '$feature',
          cost: { $sum: '$costUsd' },
          calls: { $sum: 1 },
          tokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } },
        },
      },
      { $sort: { cost: -1 } },
    ]);
    return rows.map((r) => ({
      feature: r._id ?? 'other',
      costUsd: round(r.cost),
      calls: r.calls,
      tokens: r.tokens,
    }));
  }

  async topUsers(days = 30, limit = 10) {
    const rows = await this.usage.aggregate<{
      _id: unknown;
      cost: number;
      calls: number;
    }>([
      { $match: { createdAt: { $gte: this.since(days) } } },
      {
        $group: {
          _id: '$user',
          cost: { $sum: '$costUsd' },
          calls: { $sum: 1 },
        },
      },
      { $sort: { cost: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
    ]);
    return rows.map((r) => {
      const u = (r as { user?: { name?: string; email?: string }[] }).user?.[0];
      return {
        userId: String(r._id),
        name: u?.name ?? '—',
        email: u?.email ?? '—',
        costUsd: round(r.cost),
        calls: r.calls,
      };
    });
  }

  providers() {
    return this.gateway.snapshot();
  }

  // ── budget policies ──
  async getBudget(ownerType: 'user' | 'org' | 'plan', ownerId: string) {
    const doc = await this.budgets
      .findOne({ ownerType, ownerId })
      .lean<AiBudgetPolicyDocument>()
      .exec();
    return doc ?? null;
  }

  async setBudget(
    ownerType: 'user' | 'org' | 'plan',
    ownerId: string,
    patch: Partial<AiBudgetPolicy>,
  ) {
    return this.budgets
      .findOneAndUpdate(
        { ownerType, ownerId },
        { $set: patch },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
  }
}
