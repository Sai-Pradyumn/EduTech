import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from '../billing/schemas/subscription.schema';
import {
  FeatureKey,
  FEATURE_KEYS,
  FEATURE_LABELS,
  MONTHLY_FEATURES,
  Plan,
  PlanId,
  limitFor,
  planById,
} from '../billing/plans';
import {
  EntitlementUsage,
  EntitlementUsageDocument,
  OwnerType,
} from './schemas/entitlement-usage.schema';

export interface EntitlementCheck {
  featureKey: FeatureKey;
  allowed: boolean;
  used: number;
  limit: number; // -1 unlimited, 0 blocked
  remaining: number; // -1 when unlimited
  resetAt: string;
  reason?: 'ok' | 'hard_limit' | 'blocked';
}

export interface EntitlementSummary {
  planId: PlanId;
  planName: string;
  scope: 'user' | 'org';
  features: EntitlementCheck[];
}

interface Period {
  start: Date;
  end: Date;
}

/**
 * Central entitlement enforcement (Phase 10 · M1). Resolves the owner's plan, exposes
 * check()/consume() against per-feature monthly counters, and is the single gate every
 * paid/limited capability consults. Decoupled from BillingModule — it reads the
 * Subscription model directly to avoid a circular dependency with AiModule.
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(
    @InjectModel(Subscription.name)
    private readonly subs: Model<SubscriptionDocument>,
    @InjectModel(EntitlementUsage.name)
    private readonly usage: Model<EntitlementUsageDocument>,
  ) {}

  /** Resolve the effective plan for a user (their own sub today; org override is future work). */
  async resolvePlan(userId: string): Promise<Plan> {
    const sub = await this.subs
      .findOne({ user: new Types.ObjectId(userId) })
      .lean<SubscriptionDocument>()
      .exec();
    if (sub && (sub.status === 'active' || sub.status === 'past_due')) {
      return planById(sub.planId);
    }
    return planById('free');
  }

  /** Current billing period: monthly features roll on the calendar month. */
  private periodFor(): Period {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  /** Non-mutating check: would consuming `amount` of `featureKey` be allowed right now? */
  async check(
    userId: string,
    featureKey: FeatureKey,
    amount = 1,
  ): Promise<EntitlementCheck> {
    const plan = await this.resolvePlan(userId);
    return this.checkForPlan(plan.id, 'user', userId, featureKey, amount);
  }

  private async checkForPlan(
    planId: PlanId,
    ownerType: OwnerType,
    ownerId: string,
    featureKey: FeatureKey,
    amount: number,
  ): Promise<EntitlementCheck> {
    const limit = limitFor(planId, featureKey);
    const period = this.periodFor();
    const row = await this.usage
      .findOne({
        ownerType,
        ownerId,
        featureKey,
        periodStart: period.start,
      })
      .lean<EntitlementUsageDocument>()
      .exec();
    const used = row?.used ?? 0;

    if (limit === 0) {
      return {
        featureKey,
        allowed: false,
        used,
        limit,
        remaining: 0,
        resetAt: period.end.toISOString(),
        reason: 'blocked',
      };
    }
    if (limit === -1) {
      return {
        featureKey,
        allowed: true,
        used,
        limit,
        remaining: -1,
        resetAt: period.end.toISOString(),
        reason: 'ok',
      };
    }
    const allowed = used + amount <= limit;
    return {
      featureKey,
      allowed,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: period.end.toISOString(),
      reason: allowed ? 'ok' : 'hard_limit',
    };
  }

  /**
   * Atomically increment usage for a feature. Returns the resulting check. Never throws —
   * metering failures must not break the underlying product action. Pass `enforce: false`
   * to record usage without blocking (used by AI metering, which already happened).
   */
  async consume(
    userId: string,
    featureKey: FeatureKey,
    amount = 1,
    enforce = false,
  ): Promise<EntitlementCheck> {
    try {
      const plan = await this.resolvePlan(userId);
      const pre = await this.checkForPlan(
        plan.id,
        'user',
        userId,
        featureKey,
        amount,
      );
      if (enforce && !pre.allowed) return pre;

      const period = this.periodFor();
      const limit = limitFor(plan.id, featureKey);
      await this.usage
        .findOneAndUpdate(
          {
            ownerType: 'user',
            ownerId: userId,
            featureKey,
            periodStart: period.start,
          },
          {
            $inc: { used: amount },
            $setOnInsert: {
              periodEnd: period.end,
              resetAt: period.end,
              limit,
            },
          },
          { upsert: true, new: true },
        )
        .exec();
      return {
        ...pre,
        used: pre.used + amount,
        remaining: limit === -1 ? -1 : Math.max(0, limit - (pre.used + amount)),
      };
    } catch (err) {
      this.logger.warn(
        `entitlement consume failed for ${featureKey}: ${(err as Error).message}`,
      );
      return {
        featureKey,
        allowed: true,
        used: 0,
        limit: -1,
        remaining: -1,
        resetAt: this.periodFor().end.toISOString(),
        reason: 'ok',
      };
    }
  }

  /** Full entitlement snapshot for /entitlements/me and the billing usage meter. */
  async summary(userId: string): Promise<EntitlementSummary> {
    const plan = await this.resolvePlan(userId);
    const features = await Promise.all(
      FEATURE_KEYS.map((key) =>
        this.checkForPlan(plan.id, 'user', userId, key, 0),
      ),
    );
    return {
      planId: plan.id,
      planName: plan.name,
      scope: plan.scope,
      features,
    };
  }

  /** Label helper exposed for clients that only have the key. */
  label(key: FeatureKey): string {
    return FEATURE_LABELS[key] ?? key;
  }

  isMonthly(key: FeatureKey): boolean {
    return MONTHLY_FEATURES.includes(key);
  }
}
