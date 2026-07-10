import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as webpush from 'web-push';
import { checkUrlShape } from '../../common/security/ssrf-guard';
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
 * Web Push (Phase 10 · M4/M5). Stores per-device subscriptions and sends real Web Push
 * notifications via VAPID when keys are configured; a safe no-op otherwise — so local dev
 * works without keys and the notification layer can call notify() unconditionally.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(
    @InjectModel(PushSubscription.name)
    private readonly subs: Model<PushSubscriptionDocument>,
    private readonly config: ConfigService,
  ) {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY') ?? '';
    this.configured = !!(pub && priv);
    if (this.configured) {
      webpush.setVapidDetails(
        this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:support@asta.dev',
        pub,
        priv,
      );
      this.logger.log('Web Push configured (VAPID).');
    }
  }

  /** Public VAPID key for the browser to subscribe with (empty when not configured). */
  vapidPublicKey(): { key: string; configured: boolean } {
    const key = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    return { key, configured: this.configured };
  }

  async subscribe(userId: string, input: WebPushInput) {
    // The endpoint is a browser-supplied URL the server later POSTs to — require a public
    // https target so a crafted subscription can't aim pushes at internal services
    // (SSRF · SECURITY_IMPLEMENTATION.md §4.6). Real push endpoints (FCM/Mozilla/WNS) are
    // always public https, so this rejects nothing legitimate.
    const shape = checkUrlShape(input.endpoint, {
      allowedProtocols: ['https:'],
    });
    if (!shape.ok) {
      throw new BadRequestException(
        `Invalid push endpoint: ${shape.reason ?? 'must be a public https URL'}`,
      );
    }
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

  /** Send a Web Push to all of a user's devices. No-op (returns 0) when VAPID isn't
   *  configured. Prunes subscriptions the push service reports as gone (404/410). */
  async notify(
    userId: string,
    payload: { title: string; body: string; url?: string },
  ): Promise<{ sent: number }> {
    const subs = await this.subs
      .find({ user: new Types.ObjectId(userId) })
      .lean<PushSubscriptionDocument[]>()
      .exec();
    if (!this.configured) {
      this.logger.debug(
        `web-push not configured; skipping ${subs.length} sub(s) for "${payload.title}"`,
      );
      return { sent: 0 };
    }
    const body = JSON.stringify(payload);
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: s.keys as { p256dh: string; auth: string },
            },
            body,
          );
          sent += 1;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await this.subs.deleteOne({ endpoint: s.endpoint }).exec();
          } else {
            this.logger.warn(`push send failed: ${(err as Error).message}`);
          }
        }
      }),
    );
    return { sent };
  }
}
