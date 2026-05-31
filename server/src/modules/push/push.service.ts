import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PushSubscription,
  PushSubscriptionDocument,
} from './schemas/push-subscription.schema';

export interface WebPushInput {
  endpoint: string;
  keys: Record<string, string>;
  userAgent?: string;
}

/**
 * Web Push foundation (Phase 10 · M4/M5). Stores per-device subscriptions and exposes a
 * `notify()` that is a safe no-op until a VAPID key + web-push sender are configured — so
 * local dev works without keys and the notification layer can call it unconditionally.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectModel(PushSubscription.name)
    private readonly subs: Model<PushSubscriptionDocument>,
    private readonly config: ConfigService,
  ) {}

  /** Public VAPID key for the browser to subscribe with (empty when not configured). */
  vapidPublicKey(): { key: string; configured: boolean } {
    const key = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    return { key, configured: !!key };
  }

  async subscribe(userId: string, input: WebPushInput) {
    await this.subs.updateOne(
      { endpoint: input.endpoint },
      {
        $set: {
          user: new Types.ObjectId(userId),
          endpoint: input.endpoint,
          keys: input.keys,
          userAgent: input.userAgent,
        },
      },
      { upsert: true },
    );
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.subs
      .deleteOne({ user: new Types.ObjectId(userId), endpoint })
      .exec();
    return { unsubscribed: true };
  }

  /** Best-effort push. Placeholder sender — logs intent until web-push is wired. */
  async notify(
    userId: string,
    payload: { title: string; body: string; url?: string },
  ): Promise<{ sent: number }> {
    const subs = await this.subs
      .find({ user: new Types.ObjectId(userId) })
      .lean<PushSubscriptionDocument[]>()
      .exec();
    if (!this.vapidPublicKey().configured) {
      this.logger.debug(
        `web-push not configured; skipping ${subs.length} sub(s) for "${payload.title}"`,
      );
      return { sent: 0 };
    }
    // Real send would import 'web-push' and call sendNotification per sub here.
    return { sent: subs.length };
  }
}
