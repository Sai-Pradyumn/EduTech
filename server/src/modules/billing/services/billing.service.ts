import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  AiUsageLog,
  AiUsageLogDocument,
} from '../../ai/schemas/ai-usage-log.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from '../schemas/payment-transaction.schema';
import { Plan, PLAN_CATALOG, PlanId, planById } from '../plans';

export interface SubscriptionView {
  planId: PlanId;
  plan: Plan;
  status: string;
  startedAt: string;
  currentPeriodEnd?: string;
}

export interface UsageView {
  planId: PlanId;
  aiCalls: number;
  aiLimit: number; // -1 = unlimited
  tokens: number;
  costUsd: number;
  periodStart: string;
  overLimit: boolean;
}

export interface TransactionView {
  id: string;
  planId: string;
  amountInr: number;
  status: string;
  reference: string;
  createdAt: string;
}

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subs: Model<SubscriptionDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly txns: Model<PaymentTransactionDocument>,
    @InjectModel(AiUsageLog.name)
    private readonly usage: Model<AiUsageLogDocument>,
  ) {}

  plans(): Plan[] {
    return PLAN_CATALOG;
  }

  async getSubscription(userId: string): Promise<SubscriptionView> {
    const sub = await this.subs
      .findOne({ user: new Types.ObjectId(userId) })
      .lean<SubscriptionDocument>()
      .exec();
    const planId = (sub?.planId as PlanId) ?? 'free';
    return {
      planId,
      plan: planById(planId),
      status: sub?.status ?? 'active',
      startedAt:
        (sub?.startedAt ?? new Date()).toISOString?.() ??
        new Date().toISOString(),
      currentPeriodEnd: sub?.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toISOString()
        : undefined,
    };
  }

  /** Mock checkout — records a paid transaction and upserts the subscription. */
  async checkout(
    userId: string,
    planId: PlanId,
  ): Promise<{ subscription: SubscriptionView; transaction: TransactionView }> {
    const plan = planById(planId);
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const txn = await this.txns.create({
      user: new Types.ObjectId(userId),
      planId,
      amountInr: plan.priceInr,
      currency: 'INR',
      status: 'paid',
      provider: 'mock',
      reference: `mock_${randomUUID().slice(0, 12)}`,
    });

    await this.subs
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        {
          $set: {
            planId,
            status: 'active',
            provider: 'mock',
            startedAt: new Date(),
            currentPeriodEnd: periodEnd,
          },
        },
        { new: true, upsert: true },
      )
      .exec();

    return {
      subscription: await this.getSubscription(userId),
      transaction: {
        id: String(txn._id),
        planId,
        amountInr: plan.priceInr,
        status: 'paid',
        reference: txn.reference,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async usageThisPeriod(userId: string): Promise<UsageView> {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const [agg] = await this.usage.aggregate<{
      calls: number;
      tokens: number;
      cost: number;
    }>([
      {
        $match: {
          user: new Types.ObjectId(userId),
          createdAt: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          tokens: { $sum: { $add: ['$tokensIn', '$tokensOut'] } },
          cost: { $sum: '$costUsd' },
        },
      },
    ]);

    const sub = await this.getSubscription(userId);
    const limit = sub.plan.aiCallsPerMonth;
    const calls = agg?.calls ?? 0;
    return {
      planId: sub.planId,
      aiCalls: calls,
      aiLimit: limit,
      tokens: agg?.tokens ?? 0,
      costUsd: Math.round((agg?.cost ?? 0) * 10000) / 10000,
      periodStart: periodStart.toISOString(),
      overLimit: limit >= 0 && calls >= limit,
    };
  }

  async listTransactions(userId: string): Promise<TransactionView[]> {
    const list = await this.txns
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean<PaymentTransactionDocument[]>()
      .exec();
    return list.map((t) => ({
      id: String(t._id),
      planId: t.planId,
      amountInr: t.amountInr,
      status: t.status,
      reference: t.reference,
      createdAt: (t as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    }));
  }
}
