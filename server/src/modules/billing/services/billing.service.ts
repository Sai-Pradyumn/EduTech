import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiUsageLog,
  AiUsageLogDocument,
} from '../../ai/schemas/ai-usage-log.schema';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from '../schemas/payment-transaction.schema';
import { Plan, PLAN_CATALOG, PlanId, planById } from '../plans';
import {
  PAYMENT_PROVIDER_TOKEN,
  PaymentProvider,
} from '../providers/payment-provider.interface';

export interface SubscriptionView {
  planId: PlanId;
  plan: Plan;
  status: string;
  startedAt: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  provider: string;
}

export interface UsageView {
  planId: PlanId;
  aiCalls: number;
  aiLimit: number; // -1 = unlimited
  tokens: number;
  costUsd: number;
  periodStart: string;
  overLimit: boolean;
  /** Cost grouped by product feature (Phase 10 · M2). */
  byFeature: { feature: string; calls: number; costUsd: number }[];
}

export interface TransactionView {
  id: string;
  planId: string;
  amountInr: number;
  status: string;
  reference: string;
  provider: string;
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
    private readonly entitlements: EntitlementsService,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly payment: PaymentProvider,
  ) {}

  plans(): Plan[] {
    return PLAN_CATALOG.filter((p) => p.isPublic);
  }

  paymentProviderInfo() {
    return { provider: this.payment.name, live: this.payment.isLive };
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
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      provider: sub?.provider ?? 'mock',
    };
  }

  /** Mock-or-provider checkout — records a transaction and upserts the subscription. */
  async checkout(
    userId: string,
    planId: PlanId,
  ): Promise<{ subscription: SubscriptionView; transaction: TransactionView }> {
    const plan = planById(planId);
    const session = await this.payment.createCheckout({
      userId,
      planId,
      amountInr: plan.priceInr,
    });

    const txn = await this.txns.create({
      user: new Types.ObjectId(userId),
      planId,
      amountInr: session.amountInr,
      currency: session.currency,
      status: session.status,
      provider: session.provider,
      reference: session.reference,
    });

    if (session.status === 'paid') {
      await this.activate(userId, planId, session.provider, session.reference);
    }

    return {
      subscription: await this.getSubscription(userId),
      transaction: {
        id: String(txn._id),
        planId,
        amountInr: session.amountInr,
        status: session.status,
        reference: session.reference,
        provider: session.provider,
        createdAt: new Date().toISOString(),
      },
    };
  }

  /** Switch plan. Upgrades go through checkout; downgrade to free cancels immediately. */
  async changePlan(userId: string, planId: PlanId): Promise<SubscriptionView> {
    if (planId === 'free') {
      await this.activate(userId, 'free', 'mock', '');
      return this.getSubscription(userId);
    }
    const { subscription } = await this.checkout(userId, planId);
    return subscription;
  }

  /** Cancel at period end — keeps access until currentPeriodEnd, then reverts to free. */
  async cancel(userId: string): Promise<SubscriptionView> {
    const sub = await this.subs
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
    if (sub) {
      await this.payment
        .cancel(sub.providerSubscriptionId ?? '')
        .catch(() => undefined);
      sub.cancelAtPeriodEnd = true;
      sub.status = 'canceled';
      await sub.save();
    }
    return this.getSubscription(userId);
  }

  private async activate(
    userId: string,
    planId: PlanId,
    provider: string,
    reference: string,
  ): Promise<void> {
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 30);
    await this.subs
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        {
          $set: {
            planId,
            status: 'active',
            provider,
            providerSubscriptionId: reference,
            startedAt: new Date(),
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
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

    const byFeatureAgg = await this.usage.aggregate<{
      _id: string;
      calls: number;
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
          _id: '$feature',
          calls: { $sum: 1 },
          cost: { $sum: '$costUsd' },
        },
      },
      { $sort: { cost: -1 } },
    ]);

    const sub = await this.getSubscription(userId);
    const limit = sub.plan.aiCallsPerMonth;
    const calls = agg?.calls ?? 0;
    return {
      planId: sub.planId,
      aiCalls: calls,
      aiLimit: limit,
      tokens: agg?.tokens ?? 0,
      costUsd: round4(agg?.cost ?? 0),
      periodStart: periodStart.toISOString(),
      overLimit: limit >= 0 && calls >= limit,
      byFeature: byFeatureAgg.map((f) => ({
        feature: f._id ?? 'other',
        calls: f.calls,
        costUsd: round4(f.cost),
      })),
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
      provider: t.provider,
      createdAt: (t as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    }));
  }

  /** Admin billing overview — accounts, plan distribution, MRR estimate (Phase 10 · M1). */
  async adminOverview() {
    const subs = await this.subs.find().lean<SubscriptionDocument[]>().exec();
    const byPlan: Record<string, number> = {};
    let mrr = 0;
    for (const s of subs) {
      const planId = s.planId ?? 'free';
      byPlan[planId] = (byPlan[planId] ?? 0) + 1;
      if (s.status === 'active') mrr += planById(planId).priceInr;
    }
    const paid = subs.filter(
      (s) => s.planId !== 'free' && s.status === 'active',
    ).length;
    const txnCount = await this.txns.countDocuments({ status: 'paid' });
    return {
      totalAccounts: subs.length,
      paidAccounts: paid,
      mrrInr: mrr,
      byPlan: PLAN_CATALOG.map((p) => ({
        planId: p.id,
        name: p.name,
        count: byPlan[p.id] ?? 0,
        priceInr: p.priceInr,
      })),
      paidTransactions: txnCount,
    };
  }

  async adminAccounts(limit = 50) {
    const subs = await this.subs
      .find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('user', 'name email')
      .lean()
      .exec();
    return subs.map((s) => {
      const u = s.user as unknown as {
        _id?: Types.ObjectId;
        name?: string;
        email?: string;
      };
      return {
        userId: String(u?._id ?? ''),
        name: u?.name ?? '—',
        email: u?.email ?? '—',
        planId: s.planId,
        status: s.status,
        provider: s.provider,
        currentPeriodEnd: s.currentPeriodEnd
          ? new Date(s.currentPeriodEnd).toISOString()
          : null,
      };
    });
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
