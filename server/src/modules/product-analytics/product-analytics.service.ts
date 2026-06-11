import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProductEvent,
  ProductEventDocument,
} from './schemas/product-event.schema';

/** Curated event whitelist (Phase 10 · M8). Only these are accepted, so the funnel stays
 *  clean and no arbitrary/PII-laden events can be injected. */
export const PRODUCT_EVENTS = [
  'signup_started',
  'signup_completed',
  'onboarding_completed',
  'roadmap_generated',
  'flow_generated',
  'quiz_completed',
  'project_submitted',
  'tutor_used',
  'voice_session_started',
  'study_space_created',
  'certificate_issued',
  'portfolio_published',
  'billing_upgrade_clicked',
  'subscription_started',
  'trial_started',
  'trial_converted',
  'user_returned',
  'user_churn_risk_detected',
  'web_vital',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

const FUNNELS: { name: string; steps: ProductEventName[] }[] = [
  {
    name: 'Activation',
    steps: [
      'signup_completed',
      'onboarding_completed',
      'roadmap_generated',
      'quiz_completed',
    ],
  },
  {
    name: 'Monetization',
    steps: [
      'signup_completed',
      'billing_upgrade_clicked',
      'subscription_started',
    ],
  },
  {
    name: 'Outcome',
    steps: ['roadmap_generated', 'project_submitted', 'portfolio_published'],
  },
];

@Injectable()
export class ProductAnalyticsService {
  private readonly logger = new Logger(ProductAnalyticsService.name);

  constructor(
    @InjectModel(ProductEvent.name)
    private readonly events: Model<ProductEventDocument>,
  ) {}

  isKnown(event: string): event is ProductEventName {
    return (PRODUCT_EVENTS as readonly string[]).includes(event);
  }

  /** Record an event. Unknown events are ignored. Never throws into the caller. */
  async track(input: {
    event: string;
    userId?: string;
    orgId?: string;
    properties?: Record<string, unknown>;
    anonymousId?: string;
    sessionId?: string;
  }): Promise<{ tracked: boolean }> {
    if (!this.isKnown(input.event)) return { tracked: false };
    try {
      await this.events.create({
        user: input.userId ? new Types.ObjectId(input.userId) : undefined,
        org: input.orgId ? new Types.ObjectId(input.orgId) : undefined,
        event: input.event,
        properties: this.sanitize(input.properties),
        anonymousId: input.anonymousId,
        sessionId: input.sessionId,
      });
      return { tracked: true };
    } catch (err) {
      this.logger.warn(`track failed: ${(err as Error).message}`);
      return { tracked: false };
    }
  }

  /** Drop anything but primitive props (no content/PII leakage). */
  private sanitize(props?: Record<string, unknown>): Record<string, unknown> {
    if (!props) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (['string', 'number', 'boolean'].includes(typeof v)) {
        out[k] = typeof v === 'string' ? v.slice(0, 120) : v;
      }
    }
    return out;
  }

  async overview(days = 30) {
    const since = new Date(Date.now() - days * 86400_000);
    const dayMs = 86400_000;
    const [dau, wau, totals] = await Promise.all([
      this.events.distinct('user', {
        createdAt: { $gte: new Date(Date.now() - dayMs) },
        user: { $ne: null },
      }),
      this.events.distinct('user', {
        createdAt: { $gte: new Date(Date.now() - 7 * dayMs) },
        user: { $ne: null },
      }),
      this.events.countDocuments({ createdAt: { $gte: since } }),
    ]);
    const byEvent = await this.events.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$event', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]);
    return {
      windowDays: days,
      dau: dau.length,
      wau: wau.length,
      totalEvents: totals,
      byEvent: byEvent.map((e) => ({ event: e._id, count: e.n })),
    };
  }

  async funnels(days = 30) {
    const since = new Date(Date.now() - days * 86400_000);
    return Promise.all(
      FUNNELS.map(async (f) => {
        const steps = await Promise.all(
          f.steps.map(async (event) => {
            const users = await this.events.distinct('user', {
              event,
              createdAt: { $gte: since },
              user: { $ne: null },
            });
            return { event, users: users.length };
          }),
        );
        const top = steps[0]?.users || 0;
        return {
          name: f.name,
          steps: steps.map((s) => ({
            ...s,
            conversionPct: top ? Math.round((s.users / top) * 100) : 0,
          })),
        };
      }),
    );
  }

  async retention(days = 30) {
    const since = new Date(Date.now() - days * 86400_000);
    const rows = await this.events.aggregate<{ _id: string; users: unknown[] }>(
      [
        { $match: { createdAt: { $gte: since }, user: { $ne: null } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            users: { $addToSet: '$user' },
          },
        },
        { $sort: { _id: 1 } },
      ],
    );
    return rows.map((r) => ({ day: r._id, activeUsers: r.users.length }));
  }
}
